"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseStoriesCsv } from "@/lib/csv/parse";
import type { FormState } from "@/lib/form-state";
import { db } from "@/lib/server/db";
import { requireProject, requireUser } from "@/lib/server/dal";
import { projectDefaults, readinessData, settingsOf, toStory } from "@/lib/server/readiness";
import { recordUsage } from "@/lib/server/usage";
import { readStoryForm } from "@/lib/stories/form";
import { normalizeKey, type Story } from "@/lib/stories/types";
import { Prisma } from "@/generated/prisma/client";
import { MAX_PROJECTS, MAX_STORIES_PER_PROJECT } from "@/lib/limits";
import { demoBacklog } from "@/demo/backlog";
import type { RuleSettings } from "@/lib/readiness/rules";
import { DEFAULT_RULE_SETTINGS, parseCustomChecks, parseRuleSettings } from "@/lib/readiness/settings";

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
      ...story,
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
  const existing = await db.story.findFirst({ where: { id: storyId, projectId: project.id }, select: { id: true, key: true } });
  if (!existing) return { error: "This story no longer exists." };

  const { story: fields, fieldErrors } = readStoryForm(formData);
  delete fieldErrors.key;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const story: Story = { key: existing.key, ...fields };
  const readiness = readinessData(story, settingsOf(project));
  await db.story.update({
    where: { id: existing.id },
    data: {
      ...fields,
      // A changed story makes its old AI suggestion stale.
      readiness: { upsert: { create: readiness, update: { ...readiness, aiSuggestion: Prisma.DbNull } } },
    },
  });
  await recordUsage("check_run");
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}/stories/${existing.id}?saved=1`);
}

/**
 * CSV import. The page previews the file with the same parser; this re-parses
 * on the server, then adds new keys and updates existing ones.
 */
export async function importStories(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const csv = formData.get("csv");
  if (typeof csv !== "string" || csv.trim() === "") return { error: "Choose a CSV file first." };

  const parsed = parseStoriesCsv(csv);
  if (!parsed.ok) {
    return { error: parsed.errors.map((e) => (e.row ? `Row ${e.row}: ${e.message}` : e.message)).join(" ") };
  }

  const existingKeys = new Set(
    (await db.story.findMany({ where: { projectId: project.id }, select: { key: true } })).map((s) => s.key),
  );
  const newCount = parsed.stories.filter((s) => !existingKeys.has(s.key)).length;
  if (existingKeys.size + newCount > MAX_STORIES_PER_PROJECT) {
    return {
      error: `This import would take the project past ${MAX_STORIES_PER_PROJECT} stories. Delete some stories or split the project.`,
    };
  }

  const settings = settingsOf(project);
  await db.$transaction(
    parsed.stories.map((story) => {
      const readiness = readinessData(story, settings);
      return db.story.upsert({
        where: { projectId_key: { projectId: project.id, key: story.key } },
        create: { projectId: project.id, ...story, readiness: { create: readiness } },
        update: {
          ...story,
          // A changed story makes its old AI suggestion stale.
          readiness: { upsert: { create: readiness, update: { ...readiness, aiSuggestion: Prisma.DbNull } } },
        },
      });
    }),
  );
  await recordUsage("import");
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}?imported=${parsed.stories.length}`);
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
  await db.$transaction(
    fresh.map((story) =>
      db.story.create({ data: { projectId: project.id, ...story, readiness: { create: readinessData(story, settings) } } }),
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
