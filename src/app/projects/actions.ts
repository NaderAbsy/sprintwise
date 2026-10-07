"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readImportPayload } from "@/lib/csv/import";
import { rememberedColumns } from "@/lib/csv/parse";
import type { FormState } from "@/lib/form-state";
import { db } from "@/lib/server/db";
import { requireProject, requireUser } from "@/lib/server/dal";
import { projectDefaults, readinessData, settingsOf, toStory } from "@/lib/server/readiness";
import { doneStatusesOf } from "@/lib/server/sprint";
import { recordSprintChanges } from "@/lib/server/tracking";
import { recordUsage } from "@/lib/server/usage";
import { readStoryForm, STORY_LIMITS } from "@/lib/stories/form";
import { planMove } from "@/lib/stories/rank";
import { isDone } from "@/lib/sprint/metrics";
import { normalizeKey, parsePoints, type Story } from "@/lib/stories/types";
import { Prisma } from "@/generated/prisma/client";
import { MAX_PROJECTS, MAX_STORIES_PER_PROJECT } from "@/lib/limits";
import { demoBacklog } from "@/demo/backlog";
import type { RuleSettings } from "@/lib/readiness/rules";
import { DEFAULT_RULE_SETTINGS, parseCustomChecks, parseDoneStatuses, parseRuleSettings } from "@/lib/readiness/settings";

const projectName = z
  .string()
  .trim()
  .min(1, "Give the project a name.")
  .max(80, "Keep the name under 80 characters.");

// ---------------------------------------------------------------------------
// Projects (story F-4)
// ---------------------------------------------------------------------------

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = projectName.safeParse(formData.get("name"));
  if (!name.success) return { fieldErrors: { name: name.error.issues[0].message } };

  const count = await db.project.count({ where: { userId: user.id } });
  if (count >= MAX_PROJECTS) {
    return { error: `You can have up to ${MAX_PROJECTS} projects. Delete one to make room.` };
  }

  const project = await db.project.create({
    data: { userId: user.id, name: name.data, ...projectDefaults },
  });
  // The sidebar lists projects, so refresh the shared layout too.
  revalidatePath("/projects", "layout");
  redirect(`/projects/${project.id}`);
}

export async function renameProject(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const name = projectName.safeParse(formData.get("name"));
  if (!name.success) return { fieldErrors: { name: name.error.issues[0].message } };

  await db.project.update({ where: { id: project.id }, data: { name: name.data } });
  revalidatePath("/projects", "layout");
  return { message: "Project renamed." };
}

export async function deleteProject(projectId: string) {
  const project = await requireProject(projectId);
  // Cascades to stories, scores, sprints, snapshots and changes.
  await db.project.delete({ where: { id: project.id } });
  revalidatePath("/projects", "layout");
  redirect("/projects");
}

// ---------------------------------------------------------------------------
// Stories (stories R-1 and R-2)
// ---------------------------------------------------------------------------

async function nextStoryKey(projectId: string): Promise<string> {
  const keys = await db.story.findMany({ where: { projectId, key: { startsWith: "STORY-" } }, select: { key: true } });
  const highest = keys.reduce((max, { key }) => Math.max(max, Number(key.slice(6)) || 0), 0);
  return `STORY-${highest + 1}`;
}

/** The rank after the last story, so new stories join the bottom of the backlog. */
async function bottomRank(projectId: string): Promise<number> {
  const last = await db.story.aggregate({ where: { projectId }, _max: { rank: true } });
  return (last._max.rank ?? 0) + 1;
}

/** Paste one story: score it, save it, and open its result. */
export async function addStory(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const { story: fields, rawKey, fieldErrors } = readStoryForm(formData);
  if ((await db.story.count({ where: { projectId: project.id } })) >= MAX_STORIES_PER_PROJECT) {
    return { error: `A project can hold up to ${MAX_STORIES_PER_PROJECT} stories. Delete some to make room.` };
  }

  const key = rawKey === "" ? await nextStoryKey(project.id) : normalizeKey(rawKey);
  if (!fieldErrors.key && (await db.story.findUnique({ where: { projectId_key: { projectId: project.id, key } } }))) {
    fieldErrors.key = `${key} is already in this project. Use another key, or leave it blank.`;
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const story: Story = { key, ...fields };
  const created = await db.story.create({
    data: {
      projectId: project.id,
      rank: await bottomRank(project.id),
      ...story,
      // Written here, so it isn't in Jira yet.
      editedAt: new Date(),
      readiness: { create: readinessData(story, settingsOf(project)) },
    },
  });
  await recordUsage("check_run");
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}/stories/${created.id}`);
}

/** Edit a saved story and re-score it. The key stays, because sprints match stories by key. */
export async function updateStory(projectId: string, storyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const existing = await db.story.findFirst({ where: { id: storyId, projectId: project.id } });
  if (!existing) return { error: "This story no longer exists." };

  const { story: fields, fieldErrors } = readStoryForm(formData);
  delete fieldErrors.key;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const story: Story = { key: existing.key, ...fields };
  const readiness = readinessData(story, settingsOf(project));
  // A change to what Jira holds (not just the status, which moves in Jira anyway) needs copying back.
  const textChanged = (["title", "description", "acceptanceCriteria", "storyPoints", "issueType"] as const).some(
    (field) => (fields[field] ?? "") !== (existing[field] ?? ""),
  );
  await db.story.update({
    where: { id: existing.id },
    data: {
      ...fields,
      ...(textChanged && { editedAt: new Date() }),
      // A changed story makes its old AI suggestion stale.
      readiness: { upsert: { create: readiness, update: { ...readiness, aiSuggestion: Prisma.DbNull } } },
    },
  });
  await recordSprintChanges(project.id);
  await recordUsage("check_run");
  revalidatePath(`/projects/${project.id}`, "layout");
  const returnTo = formData.get("returnTo");
  if (returnTo === "refine" || returnTo === "refine-all") {
    redirect(`/projects/${project.id}/refine?story=${existing.id}${returnTo === "refine-all" ? "&scope=all" : ""}`);
  }
  redirect(`/projects/${project.id}/stories/${existing.id}?saved=1`);
}

/**
 * CSV import. The page previews the file with the same parser; this re-parses
 * on the server, then adds new keys and updates existing ones.
 */
export async function importStories(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const payload = readImportPayload(formData.get("stories"), formData.get("mapping"));
  if (!payload.ok) return { error: payload.error };
  const { stories, mapping } = payload;

  const existingKeys = new Set(
    (await db.story.findMany({ where: { projectId: project.id }, select: { key: true } })).map((s) => s.key),
  );
  const newCount = stories.filter((s) => !existingKeys.has(s.key)).length;
  if (existingKeys.size + newCount > MAX_STORIES_PER_PROJECT) {
    return {
      error: `This import would take the project past ${MAX_STORIES_PER_PROJECT} stories. Delete some stories or split the project.`,
    };
  }

  const settings = settingsOf(project);
  // New stories join the bottom in file order; existing ones keep their place.
  const firstRank = await bottomRank(project.id);
  await db.$transaction([
    ...stories.map((story, i) => {
      const readiness = readinessData(story, settings);
      return db.story.upsert({
        where: { projectId_key: { projectId: project.id, key: story.key } },
        create: { projectId: project.id, rank: firstRank + i, ...story, readiness: { create: readiness } },
        update: {
          ...story,
          // What Jira holds now replaces what was edited here.
          editedAt: null,
          // A changed story makes its old AI suggestion stale.
          readiness: { upsert: { create: readiness, update: { ...readiness, aiSuggestion: Prisma.DbNull } } },
        },
      });
    }),
    // The next file from the same Jira gets the same columns.
    db.project.update({ where: { id: project.id }, data: { importColumns: rememberedColumns(mapping) } }),
  ]);
  await recordSprintChanges(project.id);
  await recordUsage("import");
  revalidatePath(`/projects/${project.id}`, "layout");
  redirect(`/projects/${project.id}?imported=${stories.length}`);
}

/** Loads the invented demo backlog into a project, so a new user can try every screen. Existing keys are kept. */
export async function addSampleStories(projectId: string) {
  const project = await requireProject(projectId);
  const settings = settingsOf(project);
  const existing = new Set(
    (await db.story.findMany({ where: { projectId: project.id }, select: { key: true } })).map((s) => s.key),
  );
  const fresh = demoBacklog.filter((s) => !existing.has(s.key));
  if (existing.size + fresh.length > MAX_STORIES_PER_PROJECT) redirect(`/projects/${project.id}`);
  const firstRank = await bottomRank(project.id);
  await db.$transaction(
    fresh.map((story, i) =>
      db.story.create({
        data: { projectId: project.id, rank: firstRank + i, ...story, readiness: { create: readinessData(story, settings) } },
      }),
    ),
  );
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}?imported=${fresh.length}`);
}

export async function deleteStory(projectId: string, storyId: string) {
  const project = await requireProject(projectId);
  await db.story.deleteMany({ where: { id: storyId, projectId: project.id } });
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}`);
}

// ---------------------------------------------------------------------------
// Rule settings (story R-6)
// ---------------------------------------------------------------------------

/** Saves settings and re-scores every story in one transaction, so scores are never half old, half new. */
async function rescoreProject(projectId: string, settings: RuleSettings, data: Prisma.ProjectUpdateInput) {
  const stories = await db.story.findMany({ where: { projectId } });
  await db.$transaction([
    db.project.update({ where: { id: projectId }, data }),
    ...stories.map((row) => {
      const readiness = readinessData(toStory(row), settings);
      return db.readinessResult.upsert({ where: { storyId: row.id }, create: { storyId: row.id, ...readiness }, update: readiness });
    }),
  ]);
  return stories;
}

/** Saves the project's max points and vague words, then re-scores every story with them. */
export async function updateRuleSettings(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const parsed =
    formData.get("intent") === "reset"
      ? { ok: true as const, settings: DEFAULT_RULE_SETTINGS }
      : parseRuleSettings(String(formData.get("maxPoints") ?? ""), String(formData.get("vagueWords") ?? ""));
  if (!parsed.ok) return { fieldErrors: parsed.errors };

  // The team's own checks are saved separately and kept as they are.
  const settings = { ...parsed.settings, customChecks: settingsOf(project).customChecks };
  const stories = await rescoreProject(project.id, settings, {
    maxPoints: settings.maxPoints,
    vagueWords: settings.vagueWords,
  });
  revalidatePath(`/projects/${project.id}`, "layout");
  return {
    message: `Saved. ${stories.length} ${stories.length === 1 ? "story was" : "stories were"} re-scored with the new settings.`,
  };
}

/** The team's own checks: pass/fail requirements such as "Has a design link". Saving re-scores the project. */
export async function updateCustomChecks(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const list = (name: string) => formData.getAll(name).map((v) => String(v));
  const parsed = parseCustomChecks(list("checkName"), list("checkField"), list("checkPhrase"));
  if (!parsed.ok) return { fieldErrors: parsed.errors };

  const settings = { ...settingsOf(project), customChecks: parsed.checks };
  const stories = await rescoreProject(project.id, settings, { customChecks: parsed.checks as unknown as Prisma.InputJsonValue });
  revalidatePath(`/projects/${project.id}`, "layout");
  return {
    message: `Saved ${parsed.checks.length} ${parsed.checks.length === 1 ? "check" : "checks"}. ${stories.length} ${stories.length === 1 ? "story was" : "stories were"} re-scored.`,
  };
}

/** The statuses that count as finished in this project's sprint metrics. Scores don't change, so nothing is re-scored. */
export async function updateDoneStatuses(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const parsed = parseDoneStatuses(String(formData.get("doneStatuses") ?? ""));
  if (!parsed.ok) return { fieldErrors: { doneStatuses: parsed.error } };
  await db.project.update({ where: { id: project.id }, data: { doneStatuses: parsed.statuses } });
  revalidatePath(`/projects/${project.id}`, "layout");
  return { message: `Saved. Stories marked ${parsed.statuses.join(", ")} now count as done.` };
}

/**
 * Changes one story's status or points from a list, without opening it.
 * Points re-score the story; either can be recorded in a sprint that follows the backlog.
 */
export async function quickUpdateStory(projectId: string, storyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const row = await db.story.findFirst({ where: { id: storyId, projectId: project.id } });
  if (!row) return { error: "This story no longer exists." };

  const field = formData.get("field");
  const value = String(formData.get("value") ?? "").trim();
  let data: { status: string } | { storyPoints: number | null };
  if (field === "status") {
    if (value.length > STORY_LIMITS.status) return { error: `Keep the status under ${STORY_LIMITS.status} characters.` };
    data = { status: value };
  } else if (field === "storyPoints") {
    const points = parsePoints(value);
    if (!points.valid) return { error: "Points must be a number of 0 or more." };
    if (points.points !== null && points.points > STORY_LIMITS.points) return { error: `Points can't be more than ${STORY_LIMITS.points}.` };
    data = { storyPoints: points.points };
  } else {
    return { error: "Choose status or points." };
  }

  const story = { ...toStory(row), ...data };
  await db.story.update({
    where: { id: row.id },
    data: {
      ...data,
      ...("storyPoints" in data && data.storyPoints !== row.storyPoints && { editedAt: new Date() }),
      ...("storyPoints" in data && {
        readiness: { upsert: { create: readinessData(story, settingsOf(project)), update: readinessData(story, settingsOf(project)) } },
      }),
    },
  });
  await recordSprintChanges(project.id);
  revalidatePath(`/projects/${project.id}`, "layout");
  return { message: "Saved" };
}

/** Moves a story to `index` (0 = top) in the backlog's priority order. */
export async function moveStory(projectId: string, storyId: string, index: number, withFinished = true) {
  const project = await requireProject(projectId);
  if (!Number.isFinite(index)) return;
  const all = await db.story.findMany({
    where: { projectId: project.id },
    orderBy: [{ rank: "asc" }, { key: "asc" }],
    select: { id: true, rank: true, status: true },
  });
  // The index is a position in the list as shown, which hides finished stories by default.
  const doneStatuses = doneStatusesOf(project);
  const ordered = withFinished ? all : all.filter((s) => !isDone(s.status, doneStatuses));
  const plan = planMove(ordered, storyId, index);
  if (plan.kind === "rank") {
    await db.story.updateMany({ where: { id: storyId, projectId: project.id }, data: { rank: plan.rank } });
  } else if (plan.kind === "renumber") {
    await db.$transaction(plan.ids.map((id, i) => db.story.updateMany({ where: { id, projectId: project.id }, data: { rank: i + 1 } })));
  }
  revalidatePath(`/projects/${project.id}`, "layout");
}

/** The story's edits are now in Jira too, so it leaves the "Edited here" list. */
export async function markCopiedToJira(projectId: string, storyId: string) {
  const project = await requireProject(projectId);
  await db.story.updateMany({ where: { id: storyId, projectId: project.id }, data: { editedAt: null } });
  revalidatePath(`/projects/${project.id}`, "layout");
}

/**
 * Turns the read-only backlog link on, for the team's refinement meetings. Like
 * report links, the token is 32 random bytes; turning it off deletes it, and a
 * new link is different from the old one.
 */
export async function enableBacklogShare(projectId: string) {
  const project = await requireProject(projectId);
  if (!project.shareToken) {
    await db.project.update({ where: { id: project.id }, data: { shareToken: randomBytes(32).toString("base64url") } });
  }
  revalidatePath(`/projects/${project.id}`);
}

export async function disableBacklogShare(projectId: string) {
  const project = await requireProject(projectId);
  await db.project.update({ where: { id: project.id }, data: { shareToken: null } });
  revalidatePath(`/projects/${project.id}`);
}

const selectedIds = (ids: string[]) => [...new Set(ids.filter((id) => typeof id === "string"))].slice(0, MAX_STORIES_PER_PROJECT);

/** Sets one status on several stories at once, e.g. moving a batch to "Ready for refinement". */
export async function bulkSetStatus(projectId: string, ids: string[], status: string): Promise<FormState> {
  const project = await requireProject(projectId);
  const value = String(status ?? "").trim();
  if (value.length > STORY_LIMITS.status) return { error: `Keep the status under ${STORY_LIMITS.status} characters.` };
  const { count } = await db.story.updateMany({ where: { projectId: project.id, id: { in: selectedIds(ids) } }, data: { status: value } });
  await recordSprintChanges(project.id);
  revalidatePath(`/projects/${project.id}`, "layout");
  return { message: `Set ${count} ${count === 1 ? "story" : "stories"} to ${value || "no status"}.` };
}

/** Deletes several stories. Sprints that include them keep their own copies. */
export async function bulkDeleteStories(projectId: string, ids: string[]) {
  const project = await requireProject(projectId);
  await db.story.deleteMany({ where: { projectId: project.id, id: { in: selectedIds(ids) } } });
  revalidatePath(`/projects/${project.id}`, "layout");
}
