import { scoreStory, type RuleSettings } from "@/lib/readiness/rules";
import { formatDay } from "@/lib/sprint/dates";
import { diffSnapshots, indexByKey, type Change, type ChangeType } from "@/lib/sprint/diff";
import type { Story } from "@/lib/stories/types";

/**
 * Changes that alter what the team committed to. Status changes are normal
 * progress, and a rename doesn't change the work, so neither counts.
 */
export const SCOPE_CHANGES: ReadonlySet<ChangeType> = new Set(["added", "removed", "re-estimated", "criteria-changed"]);

export const isScopeChange = (change: Pick<Change, "type">) => SCOPE_CHANGES.has(change.type);

export type ReadinessGroup = {
  count: number;
  /** Mean rules score at the baseline, or null for an empty group. */
  averageScore: number | null;
};

export type ReadinessComparison = {
  changed: ReadinessGroup;
  unchanged: ReadinessGroup;
  changedKeys: string[];
};

function group(scores: number[]): ReadinessGroup {
  return {
    count: scores.length,
    averageScore: scores.length === 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length,
  };
}

/**
 * S-5: were less-ready stories the ones that changed? Each baseline story is
 * scored as it stood at the baseline, then split by whether its scope changed
 * between the baseline and the latest snapshot. Stories added later have no
 * baseline version, so they're in neither group.
 */
export function compareReadiness(baseline: Story[], latest: Story[], settings: RuleSettings): ReadinessComparison {
  const changedKeys = new Set(
    diffSnapshots(baseline, latest)
      .filter((c) => isScopeChange(c) && c.type !== "added")
      .map((c) => c.key),
  );
  const changed: number[] = [];
  const unchanged: number[] = [];
  for (const [key, story] of indexByKey(baseline)) {
    (changedKeys.has(key) ? changed : unchanged).push(scoreStory(story, settings).score);
  }
  return { changed: group(changed), unchanged: group(unchanged), changedKeys: [...changedKeys] };
}

/** One plain sentence for the report, so the reader doesn't have to compare two numbers. */
export function readinessFinding({ changed, unchanged }: ReadinessComparison): string {
  if (changed.averageScore === null) return "No committed story changed scope during the sprint.";
  if (unchanged.averageScore === null) return "Every committed story changed scope during the sprint.";
  const gap = Math.round(unchanged.averageScore - changed.averageScore);
  if (Math.abs(gap) < 5) return "Stories that changed scored about the same at the baseline as those that didn't.";
  return gap > 0
    ? `Stories that changed scored ${gap} points lower at the baseline than those that didn't.`
    : `Stories that changed scored ${-gap} points higher at the baseline than those that didn't.`;
}

/** A change log row: a change plus the "as of" day of the snapshot it appeared in, and its stored id and reason. */
export type LogRow = Change & { date: string; id?: string; reason?: string | null };

/**
 * The dated change log for snapshots in date order (baseline first): each
 * snapshot is compared with the one before it. Newest first, ties by key.
 */
export function changeLog(snapshots: { asOfDate: Date; stories: Story[] }[]): LogRow[] {
  const rows: (LogRow & { at: number; step: number })[] = [];
  snapshots.slice(1).forEach((snapshot, i) => {
    for (const change of diffSnapshots(snapshots[i].stories, snapshot.stories)) {
      rows.push({ ...change, date: formatDay(snapshot.asOfDate), at: snapshot.asOfDate.getTime(), step: i });
    }
  });
  return rows
    .sort((a, b) => b.at - a.at || b.step - a.step || a.key.localeCompare(b.key, undefined, { numeric: true }))
    .map(({ at: _at, step: _step, ...row }) => row);
}
