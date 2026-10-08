import { DONE_STATUSES, isDone } from "@/lib/sprint/metrics";
import type { Story } from "@/lib/stories/types";

export type BurnupPoint = { date: Date; scope: number; done: number };

const points = (stories: Story[]) => stories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);

/**
 * A burn-up: on each snapshot day, the sprint's total points (scope) and the
 * points of stories marked done. Done counts all work in the sprint, including
 * work added later, so the two lines meet when everything is finished. When a
 * day has several snapshots, the last one counts.
 */
export function burnupSeries(
  snapshots: { asOfDate: Date; items: Story[] }[],
  doneStatuses: readonly string[] = DONE_STATUSES,
): BurnupPoint[] {
  const byDay = new Map<number, Story[]>();
  for (const s of snapshots) byDay.set(s.asOfDate.getTime(), s.items);
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, items]) => ({
      date: new Date(time),
      scope: points(items),
      done: points(items.filter((s) => isDone(s.status, doneStatuses))),
    }));
}

/**
 * One sentence for screen readers and the chart's caption. Scope is compared
 * with the day-one commitment, not the first point drawn: a change on the
 * baseline's own day replaces that day's point. Done is a count, not a
 * percentage, so it can't be confused with Completion (done of the commitment).
 */
export function burnupSummary(series: BurnupPoint[], committed?: number): string {
  const first = series[0];
  const last = series.at(-1);
  if (!first || !last) return "No snapshots yet.";
  const start = committed ?? first.scope;
  const scope = last.scope === start ? `Scope stayed at ${start} points` : `Scope went from ${start} to ${last.scope} points`;
  return `${scope}, and ${last.done} of ${last.scope === start ? "them" : `those ${last.scope}`} ${last.done === 1 ? "is" : "are"} done.`;
}
