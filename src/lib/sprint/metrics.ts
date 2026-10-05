import { indexByKey } from "@/lib/sprint/diff";
import type { Story } from "@/lib/stories/types";

/** Statuses that count as Done unless a project sets its own. Matching ignores case and spaces at the ends. */
export const DONE_STATUSES = ["Done", "Closed", "Resolved"];

export function isDone(status: string, doneStatuses: readonly string[] = DONE_STATUSES): boolean {
  const s = status.trim().toLowerCase();
  return s !== "" && doneStatuses.some((d) => d.trim().toLowerCase() === s);
}

export type SprintMetrics = {
  baselineTotal: number;
  latestTotal: number;
  scopeAdded: number;
  scopeRemoved: number;
  reestimateTotal: number;
  /** Points of the original commitment that are Done: the sprint's velocity. */
  donePoints: number;
  /** Ratios (0.167 = 16.7%); null when the baseline total is 0. */
  netChange: number | null;
  churn: number | null;
  completion: number | null;
  /** Keys with no points in the baseline or the latest snapshot; they count as 0. */
  unestimatedKeys: string[];
};

const points = (story: Story) => story.storyPoints ?? 0;
const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

/** Compares the locked baseline with the latest snapshot. Unrounded: round only for display. */
export function computeMetrics(
  baseline: Story[],
  latest: Story[],
  doneStatuses: readonly string[] = DONE_STATUSES,
): SprintMetrics {
  const before = indexByKey(baseline);
  const after = indexByKey(latest);

  const baselineTotal = sum([...before.values()].map(points));
  const latestTotal = sum([...after.values()].map(points));

  const scopeAdded = sum([...after].filter(([key]) => !before.has(key)).map(([, s]) => points(s)));
  const scopeRemoved = sum([...before].filter(([key]) => !after.has(key)).map(([, s]) => points(s)));

  let reestimateTotal = 0;
  let donePoints = 0;
  for (const [key, old] of before) {
    const next = after.get(key);
    if (!next) continue;
    reestimateTotal += Math.abs(points(next) - points(old));
    if (isDone(next.status, doneStatuses)) donePoints += points(old);
  }

  const unestimated = new Set<string>();
  for (const [key, story] of [...before, ...after]) {
    if (story.storyPoints === null) unestimated.add(key);
  }

  const ratio = (value: number) => (baselineTotal === 0 ? null : value / baselineTotal);

  return {
    baselineTotal,
    latestTotal,
    scopeAdded,
    scopeRemoved,
    reestimateTotal,
    donePoints,
    netChange: ratio(latestTotal - baselineTotal),
    churn: ratio(scopeAdded + scopeRemoved + reestimateTotal),
    completion: ratio(donePoints),
    unestimatedKeys: [...unestimated],
  };
}

/** 0.16667 → "+16.7%"; null → "—". */
export function formatPercent(value: number | null, { signed = false } = {}): string {
  if (value === null) return "—";
  const text = `${Math.abs(value * 100).toFixed(1)}%`;
  if (value < 0) return `−${text}`;
  return signed && value > 0 ? `+${text}` : text;
}

/** 1 → "1 pt", 3 → "3 pts". */
export function formatPoints(value: number | string): string {
  return `${value} ${Number(value) === 1 ? "pt" : "pts"}`;
}
