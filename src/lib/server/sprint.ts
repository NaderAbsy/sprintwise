import "server-only";
import type { Project, Sprint } from "@/generated/prisma/client";
import { formatDay } from "@/lib/sprint/dates";
import type { ChangeType } from "@/lib/sprint/diff";
import { computeMetrics, DONE_STATUSES } from "@/lib/sprint/metrics";
import type { LogRow } from "@/lib/sprint/report";
import { trendRows } from "@/lib/sprint/trends";
import type { Story } from "@/lib/stories/types";
import { db } from "@/lib/server/db";
import { settingsOf, toStory } from "@/lib/server/readiness";

/** The project's own Done statuses; the defaults if none are stored. */
export function doneStatusesOf(project: Pick<Project, "doneStatuses">): string[] {
  return project.doneStatuses.length > 0 ? project.doneStatuses : DONE_STATUSES;
}

/** Everything the sprint page and the sprint report show. Callers check ownership first (dal.ts). */
export async function loadSprint(sprint: Pick<Sprint, "id">, doneStatuses: readonly string[] = DONE_STATUSES) {
  const [snapshots, changes] = await Promise.all([
    db.snapshot.findMany({
      where: { sprintId: sprint.id },
      orderBy: [{ asOfDate: "asc" }, { uploadedAt: "asc" }],
      include: { items: { orderBy: { key: "asc" } } },
    }),
    db.change.findMany({
      where: { sprintId: sprint.id },
      include: { toSnapshot: { select: { asOfDate: true, uploadedAt: true } } },
    }),
  ]);

  const baselineRow = snapshots.find((s) => s.isBaseline);
  const latestRow = snapshots.at(-1);
  const baseline = baselineRow?.items.map(toStory) ?? null;
  const latest = latestRow?.items.map(toStory) ?? null;

  // Dated change log, newest first.
  const log: LogRow[] = changes
    .sort(
      (a, b) =>
        b.toSnapshot.asOfDate.getTime() - a.toSnapshot.asOfDate.getTime() ||
        b.toSnapshot.uploadedAt.getTime() - a.toSnapshot.uploadedAt.getTime() ||
        a.key.localeCompare(b.key, undefined, { numeric: true }),
    )
    .map((c) => ({
      id: c.id,
      reason: c.reason,
      date: formatDay(c.toSnapshot.asOfDate),
      key: c.key,
      type: c.changeType as ChangeType,
      oldValue: c.oldValue,
      newValue: c.newValue,
      pointsDelta: c.pointsDelta,
    }));

  return {
    snapshots,
    baselineRow,
    latestRow,
    baseline,
    latest,
    metrics: baseline && latest ? computeMetrics(baseline, latest, doneStatuses) : null,
    log,
  };
}

/**
 * Every sprint in a project that has a baseline, as trend rows (oldest first).
 * Loads only each sprint's baseline and latest snapshot items. Callers check ownership first.
 */
export async function loadProjectTrends(
  project: Pick<Project, "id" | "maxPoints" | "vagueWords" | "customChecks" | "doneStatuses">,
  exceptSprintId?: string,
) {
  const sprints = await db.sprint.findMany({
    where: { projectId: project.id, ...(exceptSprintId ? { id: { not: exceptSprintId } } : {}) },
    select: {
      id: true,
      name: true,
      startDate: true,
      snapshots: {
        select: { id: true, isBaseline: true },
        orderBy: [{ asOfDate: "asc" }, { uploadedAt: "asc" }],
      },
    },
  });
  const pairs = sprints
    .map((s) => ({ sprint: s, baselineId: s.snapshots.find((x) => x.isBaseline)?.id, latestId: s.snapshots.at(-1)?.id }))
    .filter((p): p is typeof p & { baselineId: string; latestId: string } => Boolean(p.baselineId && p.latestId));
  const ids = [...new Set(pairs.flatMap((p) => [p.baselineId, p.latestId]))];
  const items = await db.snapshotItem.findMany({ where: { snapshotId: { in: ids } } });
  const bySnapshot = new Map<string, Story[]>();
  for (const item of items) bySnapshot.set(item.snapshotId, [...(bySnapshot.get(item.snapshotId) ?? []), toStory(item)]);

  return trendRows(
    pairs.map((p) => ({
      id: p.sprint.id,
      name: p.sprint.name,
      startDate: p.sprint.startDate,
      baseline: bySnapshot.get(p.baselineId) ?? [],
      latest: bySnapshot.get(p.latestId) ?? [],
      measured: p.latestId !== p.baselineId,
    })),
    settingsOf(project),
    doneStatusesOf(project),
  );
}
