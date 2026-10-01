"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseStoriesCsv } from "@/lib/csv/parse";
import type { FormState } from "@/lib/form-state";
import { db } from "@/lib/server/db";
import { requireProject, requireUser } from "@/lib/server/dal";
import { projectDefaults, readinessData, settingsOf } from "@/lib/server/readiness";
import { recordUsage } from "@/lib/server/usage";
import { normalizeKey, parsePoints, type Story } from "@/lib/stories/types";
import { Prisma } from "@/generated/prisma/client";
import { MAX_PROJECTS } from "@/lib/limits";

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
  redirect(`/projects/${project.id}`);
}

export async function renameProject(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const name = projectName.safeParse(formData.get("name"));
  if (!name.success) return { fieldErrors: { name: name.error.issues[0].message } };

  await db.project.update({ where: { id: project.id }, data: { name: name.data } });
  revalidatePath(`/projects/${project.id}`);
  return { message: "Project renamed." };
}

export async function deleteProject(projectId: string) {
  const project = await requireProject(projectId);
  // Cascades to stories, scores, sprints, snapshots and changes.
  await db.project.delete({ where: { id: project.id } });
  revalidatePath("/projects");
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
  const text = (name: string) => String(formData.get(name) ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  const title = text("title");
  if (title === "") fieldErrors.title = "Paste a story title to score.";
  if (title.length > 300) fieldErrors.title = "Keep the title under 300 characters.";
  const points = parsePoints(text("storyPoints"));
  if (!points.valid) fieldErrors.storyPoints = "Story points must be a number of 0 or more.";

  const rawKey = text("key");
  const key = rawKey === "" ? await nextStoryKey(project.id) : normalizeKey(rawKey);
  if (key.length > 50) fieldErrors.key = "Keep the key under 50 characters.";
  else if (await db.story.findUnique({ where: { projectId_key: { projectId: project.id, key } } })) {
    fieldErrors.key = `${key} is already in this project. Use another key, or leave it blank.`;
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const story: Story = {
    key,
    title,
    description: text("description"),
    acceptanceCriteria: text("acceptanceCriteria"),
    storyPoints: points.points,
    status: text("status"),
  };

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

export async function deleteStory(projectId: string, storyId: string) {
  const project = await requireProject(projectId);
  await db.story.deleteMany({ where: { id: storyId, projectId: project.id } });
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}`);
}
