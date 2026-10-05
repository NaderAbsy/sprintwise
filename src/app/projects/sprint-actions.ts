"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { parseStoriesCsv } from "@/lib/csv/parse";
import { MAX_ROWS } from "@/lib/csv/template";
import { MAX_SNAPSHOTS_PER_SPRINT, MAX_SPRINTS_PER_PROJECT } from "@/lib/limits";
import type { FormState } from "@/lib/form-state";
import { validateSnapshotDate, validateSprintDates } from "@/lib/sprint/dates";
import { diffSnapshots } from "@/lib/sprint/diff";
import { isGoalOutcome, isReason } from "@/lib/sprint/reasons";
import { db } from "@/lib/server/db";
import { requireProject, requireSprint } from "@/lib/server/dal";
import { toStory } from "@/lib/server/readiness";
import type { Story } from "@/lib/stories/types";

const sprintName = z.string().trim().min(1, "Give the sprint a name.").max(80, "Keep the name under 80 characters.");
const sprintGoal = z.string().trim().max(300, "Keep the goal under 300 characters.");

const sprintPath = (projectId: string, sprintId: string) => `/projects/${projectId}/sprints/${sprintId}`;

function parseUpload(csv: FormDataEntryValue | null): FormState | { stories: Story[] } {
  if (typeof csv !== "string" || csv.trim() === "") return { error: "Choose a CSV file first." };
  const parsed = parseStoriesCsv(csv);
  if (!parsed.ok) {
    return { error: parsed.errors.map((e) => (e.row ? `Row ${e.row}: ${e.message}` : e.message)).join(" ") };
  }
  return { stories: parsed.stories };
}

/**
 * A snapshot's stories come from a CSV, or from stories picked in the project's
 * own backlog (for teams without Jira). Picked ids are re-checked against the project.
 */
async function readSnapshotStories(projectId: string, formData: FormData): Promise<FormState | { stories: Story[] }> {
  if (formData.get("source") !== "backlog") return parseUpload(formData.get("csv"));
  const ids = [...new Set(formData.getAll("storyId").filter((v): v is string => typeof v === "string"))];
  if (ids.length === 0) return { error: "Choose at least one story from the backlog." };
  if (ids.length > MAX_ROWS) return { error: `Choose up to ${MAX_ROWS} stories.` };
  const rows = await db.story.findMany({ where: { projectId, id: { in: ids } }, orderBy: { key: "asc" } });
  if (rows.length === 0) return { error: "Those stories are no longer in the backlog. Reload the page and try again." };
  return { stories: rows.map(toStory) };
}

/** S-1: name, start and end dates required; end after start. */
export async function createSprint(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const name = sprintName.safeParse(formData.get("name"));
  const goal = sprintGoal.safeParse(formData.get("goal") ?? "");
  const dates = validateSprintDates(String(formData.get("startDate") ?? ""), String(formData.get("endDate") ?? ""));
  if (!name.success || !goal.success || !dates.ok) {
    return {
      fieldErrors: {
        ...(dates.ok ? {} : dates.errors),
        ...(name.success ? {} : { name: name.error.issues[0].message }),
        ...(goal.success ? {} : { goal: goal.error.issues[0].message }),
      },
    };
  }

  if ((await db.sprint.count({ where: { projectId: project.id } })) >= MAX_SPRINTS_PER_PROJECT) {
    return { error: `A project can hold up to ${MAX_SPRINTS_PER_PROJECT} sprints. Delete an old one to make room.` };
  }

  const sprint = await db.sprint.create({
    data: { projectId: project.id, name: name.data, goal: goal.data, startDate: dates.startDate, endDate: dates.endDate },
  });
  revalidatePath(`/projects/${project.id}/sprints`);
  redirect(sprintPath(project.id, sprint.id));
}

/** S-2: take the day-one stories (CSV or backlog) and lock them as the baseline in one step. It can't be edited or replaced afterwards. */
export async function lockBaseline(
  projectId: string,
  sprintId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { project, sprint } = await requireSprint(projectId, sprintId);
  const date = validateSnapshotDate(String(formData.get("asOfDate") ?? ""), sprint, null);
  if (!date.ok) return { fieldErrors: date.errors };
  const csv = await readSnapshotStories(project.id, formData);
  if (!("stories" in csv)) return csv;

  try {
    await db.snapshot.create({
      data: {
        sprintId: sprint.id,
        asOfDate: date.asOfDate,
        isBaseline: true,
        locked: true,
        items: { create: csv.stories },
      },
    });
  } catch (error) {
    // The partial unique index allows one baseline per sprint, even under a double submit.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This sprint already has a locked baseline." };
    }
    throw error;
  }
  revalidatePath(sprintPath(project.id, sprint.id));
  return { message: "Baseline locked." };
}

/** S-3: save a later snapshot (CSV or backlog); changes since the previous snapshot are stored for the change log. */
export async function uploadSnapshot(
  projectId: string,
  sprintId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { project, sprint } = await requireSprint(projectId, sprintId);
  const previous = await db.snapshot.findFirst({
    where: { sprintId: sprint.id },
    orderBy: [{ asOfDate: "desc" }, { uploadedAt: "desc" }],
    include: { items: true },
  });
  if (!previous) return { error: "Lock a baseline before uploading later snapshots." };
  if ((await db.snapshot.count({ where: { sprintId: sprint.id } })) >= MAX_SNAPSHOTS_PER_SPRINT) {
    return { error: `A sprint can hold up to ${MAX_SNAPSHOTS_PER_SPRINT} snapshots.` };
  }

  const date = validateSnapshotDate(String(formData.get("asOfDate") ?? ""), sprint, previous.asOfDate);
  if (!date.ok) return { fieldErrors: date.errors };
  const csv = await readSnapshotStories(project.id, formData);
  if (!("stories" in csv)) return csv;

  const changes = diffSnapshots(previous.items.map(toStory), csv.stories);
  await db.$transaction(async (tx) => {
    const snapshot = await tx.snapshot.create({
      data: { sprintId: sprint.id, asOfDate: date.asOfDate, locked: true, items: { create: csv.stories } },
    });
    if (changes.length > 0) {
      await tx.change.createMany({
        data: changes.map((c) => ({
          sprintId: sprint.id,
          fromSnapshotId: previous.id,
          toSnapshotId: snapshot.id,
          key: c.key,
          changeType: c.type,
          oldValue: c.oldValue,
          newValue: c.newValue,
          pointsDelta: c.pointsDelta,
        })),
      });
    }
  });
  revalidatePath(sprintPath(project.id, sprint.id));
  return {
    message:
      changes.length === 0
        ? "Snapshot saved. Nothing changed since the previous one."
        : `Snapshot saved with ${changes.length} ${changes.length === 1 ? "change" : "changes"}.`,
  };
}

/**
 * Takes back a baseline locked by mistake, as long as nothing has been measured
 * against it yet. Once a later snapshot exists the baseline is fixed for good.
 * One statement, so a snapshot saved at the same moment can't slip in between.
 */
export async function undoBaseline(projectId: string, sprintId: string) {
  const { project, sprint } = await requireSprint(projectId, sprintId);
  await db.snapshot.deleteMany({
    where: { sprintId: sprint.id, isBaseline: true, sprint: { snapshots: { every: { isBaseline: true } } } },
  });
  revalidatePath(sprintPath(project.id, sprint.id), "layout");
}

/** S-6: the way to start over once a baseline has later snapshots. Backlog stories are untouched. */
export async function deleteSprint(projectId: string, sprintId: string) {
  const { project, sprint } = await requireSprint(projectId, sprintId);
  await db.sprint.delete({ where: { id: sprint.id } });
  revalidatePath(`/projects/${project.id}/sprints`);
  redirect(`/projects/${project.id}/sprints`);
}

/** The sprint goal and, once the sprint is over, whether it was met. */
export async function updateSprintGoal(
  projectId: string,
  sprintId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { project, sprint } = await requireSprint(projectId, sprintId);
  const goal = sprintGoal.safeParse(formData.get("goal") ?? "");
  if (!goal.success) return { fieldErrors: { goal: goal.error.issues[0].message } };
  const outcome = formData.get("goalOutcome");
  await db.sprint.update({
    where: { id: sprint.id },
    data: { goal: goal.data, goalOutcome: isGoalOutcome(outcome) ? outcome : null },
  });
  revalidatePath(sprintPath(project.id, sprint.id), "layout");
  return { message: "Goal saved." };
}

/** Tags one scope change with why it happened, for the report's breakdown. */
export async function setChangeReason(projectId: string, sprintId: string, changeId: string, reason: string) {
  const { project, sprint } = await requireSprint(projectId, sprintId);
  // The change must belong to this sprint; the where clause enforces it.
  await db.change.updateMany({
    where: { id: changeId, sprintId: sprint.id },
    data: { reason: isReason(reason) ? reason : null },
  });
  revalidatePath(sprintPath(project.id, sprint.id), "layout");
}

/**
 * Turns the read-only report link on. The token is 32 random bytes, so the
 * link can't be guessed; turning sharing off deletes it, and a new link is
 * different from the old one.
 */
export async function enableReportShare(projectId: string, sprintId: string) {
  const { project, sprint } = await requireSprint(projectId, sprintId);
  if (!sprint.shareToken) {
    await db.sprint.update({ where: { id: sprint.id }, data: { shareToken: randomBytes(32).toString("base64url") } });
  }
  revalidatePath(`${sprintPath(project.id, sprint.id)}/report`);
}

export async function disableReportShare(projectId: string, sprintId: string) {
  const { project, sprint } = await requireSprint(projectId, sprintId);
  await db.sprint.update({ where: { id: sprint.id }, data: { shareToken: null } });
  revalidatePath(`${sprintPath(project.id, sprint.id)}/report`);
}
