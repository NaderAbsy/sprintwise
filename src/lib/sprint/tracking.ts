import { diffSnapshots, indexByKey, type Change } from "@/lib/sprint/diff";
import { normalizeKey, type Story } from "@/lib/stories/types";

const DAY_MS = 86_400_000;

/** Today as a calendar day at UTC midnight, the way sprint dates are stored. */
export function utcToday(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Whole days from `from` to `to` (both UTC-midnight days). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export type TrackedSnapshot = { id: string; asOfDate: Date; isBaseline: boolean; auto: boolean; items: Story[] };

export type TrackingPlan =
  | { kind: "none" }
  /** A new snapshot dated `asOfDate`, compared with the latest one. */
  | { kind: "create"; asOfDate: Date; items: Story[]; changes: Change[] }
  /** Today's automatic snapshot gets the new values, compared again with the one before it. */
  | { kind: "replace"; snapshotId: string; items: Story[]; changes: Change[] }
  /** Today's automatic snapshot no longer differs from the one before it, e.g. a status was changed and changed back. */
  | { kind: "delete"; snapshotId: string };

/**
 * How a sprint that follows the backlog records an edit. The sprint's stories
 * are the latest snapshot's keys; their values now come from the backlog.
 * A story deleted from the backlog keeps its last recorded values.
 *
 * Days are UTC. To allow for time zones, the snapshot is never dated before
 * the latest one or after the sprint's end, and edits up to a day after the
 * end still count (it may still be the last day where the user is).
 */
export function planTracking({
  sprint,
  latest,
  previous,
  backlog,
  today,
}: {
  sprint: { endDate: Date };
  latest: TrackedSnapshot | undefined;
  previous: TrackedSnapshot | undefined;
  backlog: Story[];
  today: Date;
}): TrackingPlan {
  if (!latest || daysBetween(sprint.endDate, today) > 1) return { kind: "none" };

  const current = indexByKey(backlog);
  const items = latest.items.map((item) => {
    const story = current.get(normalizeKey(item.key));
    return story ? { ...story, key: item.key } : item;
  });

  const day = new Date(Math.min(Math.max(today.getTime(), latest.asOfDate.getTime()), sprint.endDate.getTime()));
  const sameDayAuto = latest.auto && !latest.isBaseline && latest.asOfDate.getTime() === day.getTime();

  if (sameDayAuto && previous) {
    if (diffSnapshots(latest.items, items).length === 0) return { kind: "none" };
    const changes = diffSnapshots(previous.items, items);
    return changes.length === 0 ? { kind: "delete", snapshotId: latest.id } : { kind: "replace", snapshotId: latest.id, items, changes };
  }

  const changes = diffSnapshots(latest.items, items);
  return changes.length === 0 ? { kind: "none" } : { kind: "create", asOfDate: day, items, changes };
}

/** Reasons already tagged on a replaced snapshot's changes, carried over by key and change type. */
export function carryReasons<T extends Change>(
  changes: T[],
  old: { key: string; changeType: string; reason: string | null }[],
): (T & { reason: string | null })[] {
  const reasons = new Map(old.map((c) => [`${c.key}|${c.changeType}`, c.reason]));
  return changes.map((c) => ({ ...c, reason: reasons.get(`${c.key}|${c.type}`) ?? null }));
}
