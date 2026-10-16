"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readImportedFields, readImportPayload, readLeftOut } from "@/lib/csv/import";
import { rememberedColumns } from "@/lib/csv/parse";
import type { FormState } from "@/lib/form-state";
import { db } from "@/lib/server/db";
import { assertId, isId, requireFreshUser, requireProject, requireUser } from "@/lib/server/dal";
import { projectDefaults, readinessData, settingsOf, toStory, writeScores } from "@/lib/server/readiness";
import { doneStatusesOf } from "@/lib/server/sprint";
import { bottomRank, saveStories } from "@/lib/server/save-stories";
import { jiraSites } from "@/lib/server/jira";
import { jiraFailure, leaveOutOfSync, otherSite } from "@/lib/server/jira-sync";
import { recordSprintChanges } from "@/lib/server/tracking";
import { LimitError, withinLimit } from "@/lib/server/within-limit";
import { overLimit } from "@/lib/server/action-limits";
import { recordUsage } from "@/lib/server/usage";
import { readStoryForm, STORY_LIMITS } from "@/lib/stories/form";
import { planMove } from "@/lib/stories/rank";
import { isDone } from "@/lib/sprint/metrics";
import { normalizeKey, parsePoints, type Story } from "@/lib/stories/types";
import { Prisma } from "@/generated/prisma/client";
import { JQL_MAX, MAX_PROJECTS, MAX_STORIES_PER_PROJECT } from "@/lib/limits";
import { demoBacklog } from "@/demo/backlog";
import type { RuleSettings } from "@/lib/readiness/rules";
import { DEFAULT_RULE_SETTINGS, parseCustomChecks, parseDoneStatuses, parseRuleSettings } from "@/lib/readiness/settings";

const projectName = z.string().trim().min(1, "Give the project a name.").max(80, "Keep the name under 80 characters.");

// ---------------------------------------------------------------------------
// Projects (story F-4)
// ---------------------------------------------------------------------------

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = projectName.safeParse(formData.get("name"));
  if (!name.success) return { fieldErrors: { name: name.error.issues[0].message } };

  let project;
  try {
    project = await withinLimit(
      { user: user.id },
      {
        count: (tx) => tx.project.count({ where: { userId: user.id } }),
        max: MAX_PROJECTS,
        message: `You can have up to ${MAX_PROJECTS} projects. Delete one to make room.`,
      },
      (tx) => tx.project.create({ data: { userId: user.id, name: name.data, ...projectDefaults } }),
    );
  } catch (error) {
    if (error instanceof LimitError) return { error: error.message };
    throw error;
  }
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
  await requireFreshUser();
  const project = await requireProject(projectId);
  // Cascades to stories, scores, sprints, snapshots and changes.
  await db.project.delete({ where: { id: project.id } });
  revalidatePath("/projects", "layout");
  redirect("/projects");
}

// ---------------------------------------------------------------------------
// Stories (stories R-1 and R-2)
// ---------------------------------------------------------------------------

/**
 * The next STORY-n key. Keys in sprints count too, so a deleted story's key
 * isn't handed to a new one, which sprints would take for the old story.
 */
async function nextStoryKey(projectId: string): Promise<string> {
  const where = { key: { startsWith: "STORY-" } };
  const [inBacklog, inSprints] = await Promise.all([
    db.story.findMany({ where: { projectId, ...where }, select: { key: true } }),
    db.snapshotItem.findMany({
      where: { ...where, snapshot: { sprint: { projectId } } },
      select: { key: true },
      distinct: ["key"],
    }),
  ]);
  // Only plain numbers count: one odd key such as STORY-9999999999999999 can't be added to, and would block every new key.
  const highest = [...inBacklog, ...inSprints].reduce(
    (max, { key }) => (/^STORY-\d{1,9}$/.test(key) ? Math.max(max, Number(key.slice(6))) : max),
    0,
  );
  return `STORY-${highest + 1}`;
}

/** Paste one story: score it, save it, and open its result. */
export async function addStory(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const { story: fields, rawKey, fieldErrors } = readStoryForm(formData);
  const full = `A project can hold up to ${MAX_STORIES_PER_PROJECT} stories. Delete some to make room.`;
  if ((await db.story.count({ where: { projectId: project.id } })) >= MAX_STORIES_PER_PROJECT) return { error: full };

  const key = rawKey === "" ? await nextStoryKey(project.id) : normalizeKey(rawKey);
  if (!fieldErrors.key && (await db.story.findUnique({ where: { projectId_key: { projectId: project.id, key } } }))) {
    fieldErrors.key = `${key} is already in this project. Use another key, or leave it blank.`;
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // A new story with no status starts as To Do, as the field's hint says.
  const story: Story = { key, ...fields, status: fields.status || "To Do" };
  let created;
  try {
    created = await withinLimit(
      { project: project.id },
      { count: (tx) => tx.story.count({ where: { projectId: project.id } }), max: MAX_STORIES_PER_PROJECT, message: full },
      async (tx) =>
        tx.story.create({
          data: {
            projectId: project.id,
            rank: await bottomRank(project.id, tx),
            ...story,
            // Written here, so it isn't in Jira yet.
            editedAt: new Date(),
            readiness: { create: readinessData(story, settingsOf(project)) },
          },
        }),
    );
  } catch (error) {
    if (error instanceof LimitError) return { error: error.message };
    // The same key saved a moment ago, from another tab.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fieldErrors: { key: `${key} was just added to this project. Use another key, or leave it blank.` } };
    }
    throw error;
  }
  await recordUsage("check_run");
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}/stories/${created.id}`);
}

/** Edit a saved story and re-score it. The key stays, because sprints match stories by key. */
export async function updateStory(projectId: string, storyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  assertId(storyId);
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

/** When the preview searched Jira, as the browser sent it back; now if it's missing or implausible. */
function searchTime(value: FormDataEntryValue | null): Date {
  const now = new Date();
  const at = new Date(String(value ?? ""));
  return Number.isNaN(at.getTime()) || at > now || now.getTime() - at.getTime() > 86_400_000 ? now : at;
}

/**
 * CSV import. The page previews the file with the same parser; this re-parses
 * on the server, then adds new keys and updates existing ones.
 */
export async function importStories(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const payload = readImportPayload(formData.get("stories"), formData.get("mapping"));
  if (!payload.ok) return { error: payload.error };
  const limited = await overLimit("import", project.userId);
  if (limited) return { error: limited };

  const { stories, mapping } = payload;
  const importedKeys = new Set(stories.map((s) => s.key));

  const existingKeys = new Set(
    (await db.story.findMany({ where: { projectId: project.id }, select: { key: true } })).map((s) => s.key),
  );
  const newCount = stories.filter((s) => !existingKeys.has(s.key)).length;
  if (existingKeys.size + newCount > MAX_STORIES_PER_PROJECT) {
    return {
      error: `This import would take the project past ${MAX_STORIES_PER_PROJECT} stories. Delete some stories or split the project.`,
    };
  }

  // The next file from the same Jira gets the same columns. (An import straight from Jira has no columns to remember.)
  const fromJira = formData.get("source") === "jira";
  // From Jira, the site and search become the project's now, for Sync and Send, after checking the site is the user's.
  let jira: { jiraCloudId: string; jiraSiteName: string; jiraSiteUrl: string; jiraJql: string } | null = null;
  if (fromJira) {
    const cloudId = String(formData.get("jiraCloudId") ?? "");
    const jql = String(formData.get("jiraJql") ?? "").trim();
    if (jql === "" || jql.length > JQL_MAX) return { error: "Preview the issues from Jira again, then import." };
    const other = otherSite(project, cloudId);
    if (other) return { error: other };
    let site;
    try {
      site = (await jiraSites((await requireUser()).id)).find((s) => s.id === cloudId);
    } catch (error) {
      return { error: jiraFailure(error) };
    }
    if (!site) return { error: "That Jira site isn't connected to your account any more. Preview the issues again." };
    jira = { jiraCloudId: site.id, jiraSiteName: site.name, jiraSiteUrl: site.url, jiraJql: jql };
  }
  try {
    await saveStories(project, stories, {
      maxStories: MAX_STORIES_PER_PROJECT,
      fromJira,
      // A file without, say, a Description column leaves the descriptions already saved as they are.
      fields: fromJira ? undefined : readImportedFields(formData.get("fields")),
      extra: (tx) =>
        fromJira
          ? // Sync adds issues Jira's search finds later; the ones left unticked now stay out.
            tx.project.update({
              where: { id: project.id },
              data: {
                ...jira,
                jiraLeftOut: readLeftOut(formData.get("leftOut")).filter((key) => !importedKeys.has(key)),
                jiraSyncedAt: searchTime(formData.get("searchedAt")),
                jiraAutoSynced: false,
                jiraSyncError: null,
              },
            })
          : tx.project.update({ where: { id: project.id }, data: { importColumns: rememberedColumns(mapping) } }),
    });
  } catch (error) {
    if (error instanceof LimitError) return { error: error.message };
    throw error;
  }
  await recordSprintChanges(project.id);
  await recordUsage("import");
  revalidatePath(`/projects/${project.id}`, "layout");
  redirect(`/projects/${project.id}?imported=${stories.length}`);
}

/** Loads the invented demo backlog into a project, so a new user can try every screen. Existing keys are kept. */
export async function addSampleStories(projectId: string) {
  const project = await requireProject(projectId);
  const existing = new Set(
    (await db.story.findMany({ where: { projectId: project.id }, select: { key: true } })).map((s) => s.key),
  );
  const fresh = demoBacklog.filter((s) => !existing.has(s.key));
  // Through the same save as an import, so the story limit is counted under the same lock.
  try {
    await saveStories(project, fresh.map((s) => ({ ...s, issueType: s.issueType ?? "", epic: "" })), { maxStories: MAX_STORIES_PER_PROJECT });
  } catch (error) {
    if (error instanceof LimitError) redirect(`/projects/${project.id}`);
    throw error;
  }
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}?imported=${fresh.length}`);
}

export async function deleteStory(projectId: string, storyId: string) {
  const project = await requireProject(projectId);
  assertId(storyId);
  const gone = await db.story.findMany({ where: { id: storyId, projectId: project.id }, select: { key: true } });
  await db.story.deleteMany({ where: { id: storyId, projectId: project.id } });
  await leaveOutOfSync(project.id, gone.map((s) => s.key));
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}`);
}

// ---------------------------------------------------------------------------
// Rule settings (story R-6)
// ---------------------------------------------------------------------------

/**
 * Saves settings and re-scores every story in one transaction, so scores are never
 * half old, half new. The project row is locked first and the stories read under
 * it, so a story saved at the same moment is scored with its new text.
 */
async function rescoreProject(projectId: string, settings: RuleSettings, data: Prisma.ProjectUpdateInput) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
      await tx.project.update({ where: { id: projectId }, data });
      const stories = await tx.story.findMany({ where: { projectId } });
      await writeScores(tx, stories.map((row) => ({ storyId: row.id, readiness: readinessData(toStory(row), settings) })));
      return stories;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}

/** Saves the project's max points and vague words, then re-scores every story with them. */
export async function updateRuleSettings(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const parsed =
    formData.get("intent") === "reset"
      ? { ok: true as const, settings: DEFAULT_RULE_SETTINGS }
      : parseRuleSettings(String(formData.get("maxPoints") ?? ""), String(formData.get("vagueWords") ?? ""));
  if (!parsed.ok) return { fieldErrors: parsed.errors };
  const limited = await overLimit("rescore", project.userId);
  if (limited) return { error: limited };

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
  const limited = await overLimit("rescore", project.userId);
  if (limited) return { error: limited };

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

/** Turns the nightly Jira sync on or off for one project. `on` arrives from the browser, so only `true` counts. */
export async function setNightlySync(projectId: string, on: unknown) {
  const project = await requireProject(projectId);
  await db.project.update({ where: { id: project.id }, data: { nightlySync: on === true } });
  revalidatePath(`/projects/${project.id}`, "layout");
}

/**
 * Changes one story's status or points from a list, without opening it.
 * Points re-score the story; either can be recorded in a sprint that follows the backlog.
 */
export async function quickUpdateStory(
  projectId: string,
  storyId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const project = await requireProject(projectId);
  assertId(storyId);
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
    if (points.points !== null && points.points > STORY_LIMITS.points)
      return { error: `Points can't be more than ${STORY_LIMITS.points}.` };
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
        readiness: {
          upsert: { create: readinessData(story, settingsOf(project)), update: readinessData(story, settingsOf(project)) },
        },
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
  assertId(storyId);
  if (typeof index !== "number" || !Number.isFinite(index)) return;
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
    await db.$transaction(
      plan.ids.map((id, i) => db.story.updateMany({ where: { id, projectId: project.id }, data: { rank: i + 1 } })),
    );
  }
  revalidatePath(`/projects/${project.id}`, "layout");
}

/** The story's edits are now in Jira too, so it leaves the "Edited here" list. */
export async function markCopiedToJira(projectId: string, storyId: string) {
  const project = await requireProject(projectId);
  assertId(storyId);
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

const selectedIds = (ids: string[]) =>
  [...new Set((Array.isArray(ids) ? ids : []).filter(isId))].slice(0, MAX_STORIES_PER_PROJECT);

/** Sets one status on several stories at once, e.g. moving a batch to "Ready for refinement". */
export async function bulkSetStatus(projectId: string, ids: string[], status: string): Promise<FormState> {
  const project = await requireProject(projectId);
  const value = String(status ?? "").trim();
  if (value.length > STORY_LIMITS.status) return { error: `Keep the status under ${STORY_LIMITS.status} characters.` };
  const { count } = await db.story.updateMany({
    where: { projectId: project.id, id: { in: selectedIds(ids) } },
    data: { status: value },
  });
  await recordSprintChanges(project.id);
  revalidatePath(`/projects/${project.id}`, "layout");
  return { message: `Set ${count} ${count === 1 ? "story" : "stories"} to ${value || "no status"}.` };
}

/** Deletes several stories. Sprints that include them keep their own copies. */
export async function bulkDeleteStories(projectId: string, ids: string[]) {
  const project = await requireProject(projectId);
  const where = { projectId: project.id, id: { in: selectedIds(ids) } };
  const gone = await db.story.findMany({ where, select: { key: true } });
  await db.story.deleteMany({ where });
  await leaveOutOfSync(project.id, gone.map((s) => s.key));
  revalidatePath(`/projects/${project.id}`, "layout");
}
