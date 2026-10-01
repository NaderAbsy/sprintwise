import "server-only";
import type { Sprint } from "@/generated/prisma/client";
import { formatDay } from "@/lib/sprint/dates";
import type { Change, ChangeType } from "@/lib/sprint/diff";
import { computeMetrics } from "@/lib/sprint/metrics";
import { db } from "@/lib/server/db";
import { toStory } from "@/lib/server/readiness";

export type LogRow = Change & { date: string };

/** Everything the sprint page and the sprint report show. Callers check ownership first (dal.ts). */
export async function loadSprint(sprint: Pick<Sprint, "id">) {
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
    metrics: baseline && latest ? computeMetrics(baseline, latest) : null,
    log,
  };
}
