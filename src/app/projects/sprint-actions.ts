"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { parseStoriesCsv } from "@/lib/csv/parse";
import type { FormState } from "@/lib/form-state";
import { validateSnapshotDate, validateSprintDates } from "@/lib/sprint/dates";
import { diffSnapshots } from "@/lib/sprint/diff";
import { db } from "@/lib/server/db";
import { requireProject, requireSprint } from "@/lib/server/dal";
import { toStory } from "@/lib/server/readiness";
import type { Story } from "@/lib/stories/types";

const sprintName = z.string().trim().min(1, "Give the sprint a name.").max(80, "Keep the name under 80 characters.");

const sprintPath = (projectId: string, sprintId: string) => `/projects/${projectId}/sprints/${sprintId}`;

function parseUpload(csv: FormDataEntryValue | null): FormState | { stories: Story[] } {
  if (typeof csv !== "string" || csv.trim() === "") return { error: "Choose a CSV file first." };
  const parsed = parseStoriesCsv(csv);
  if (!parsed.ok) {
    return { error: parsed.errors.map((e) => (e.row ? `Row ${e.row}: ${e.message}` : e.message)).join(" ") };
  }
  return { stories: parsed.stories };
}

/** S-1: name, start and end dates required; end after start. */
export async function createSprint(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const project = await requireProject(projectId);
  const name = sprintName.safeParse(formData.get("name"));
  const dates = validateSprintDates(String(formData.get("startDate") ?? ""), String(formData.get("endDate") ?? ""));
  if (!name.success || !dates.ok) {
    return {
      fieldErrors: {
        ...(dates.ok ? {} : dates.errors),
        ...(name.success ? {} : { name: name.error.issues[0].message }),
      },
    };
  }

  const sprint = await db.sprint.create({
    data: { projectId: project.id, name: name.data, startDate: dates.startDate, endDate: dates.endDate },
  });
  revalidatePath(`/projects/${project.id}`);
  redirect(sprintPath(project.id, sprint.id));
}

/** S-2: upload the day-one CSV and lock it as the baseline in one step. It can't be edited or replaced afterwards. */
export async function lockBaseline(
  projectId: string,
  sprintId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { project, sprint } = await requireSprint(projectId, sprintId);
  const date = validateSnapshotDate(String(formData.get("asOfDate") ?? ""), sprint, null);
  if (!date.ok) return { fieldErrors: date.errors };
  const csv = parseUpload(formData.get("csv"));
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

/** S-3: upload a later snapshot; changes since the previous snapshot are stored for the change log. */
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

  const date = validateSnapshotDate(String(formData.get("asOfDate") ?? ""), sprint, previous.asOfDate);
  if (!date.ok) return { fieldErrors: date.errors };
  const csv = parseUpload(formData.get("csv"));
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

/** S-6: the only way to redo a wrong baseline. Backlog stories are untouched. */
export async function deleteSprint(projectId: string, sprintId: string) {
  const { project, sprint } = await requireSprint(projectId, sprintId);
  await db.sprint.delete({ where: { id: sprint.id } });
  revalidatePath(`/projects/${project.id}`);
  redirect(`/projects/${project.id}`);
}
