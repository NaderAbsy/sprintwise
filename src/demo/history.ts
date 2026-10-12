import { demoSprint } from "@/demo/sprint";
import { DEFAULT_SETTINGS } from "@/lib/readiness/rules";
import { trendRows, type SprintTrendRow } from "@/lib/sprint/trends";

/**
 * Invented history for the demo's Trends view: five earlier Tidyhome sprints,
 * then Sprint 12 measured from the sample snapshots. The story they tell: as
 * the team planned with more Ready stories, churn fell and completion rose,
 * until Sprint 12 committed two unclear stories again.
 */
/** Two-week sprints before the sample one, dated from it so the history moves with it. */
const weeksBefore = (weeks: number) => new Date(demoSprint.startDate.getTime() - weeks * 7 * 86_400_000);

const EARLIER: Omit<SprintTrendRow, "id" | "measured" | "running" | "averageScore" | "added" | "addedBugs">[] = [
  { name: "Sprint 7", startDate: weeksBefore(10), committed: 34, done: 17, completion: 0.5, churn: 0.62, netChange: 0.24, readyAtBaseline: 0.3 },
  { name: "Sprint 8", startDate: weeksBefore(8), committed: 30, done: 18, completion: 0.6, churn: 0.47, netChange: 0.13, readyAtBaseline: 0.4 },
  { name: "Sprint 9", startDate: weeksBefore(6), committed: 29, done: 22, completion: 0.76, churn: 0.31, netChange: 0.07, readyAtBaseline: 0.57 },
  { name: "Sprint 10", startDate: weeksBefore(4), committed: 28, done: 24, completion: 0.86, churn: 0.18, netChange: 0.04, readyAtBaseline: 0.75 },
  { name: "Sprint 11", startDate: weeksBefore(2), committed: 30, done: 27, completion: 0.9, churn: 0.13, netChange: 0, readyAtBaseline: 0.83 },
];

export function demoTrendRows(): SprintTrendRow[] {
  const current = trendRows(
    [
      {
        id: "demo-12",
        name: "Sprint 12",
        startDate: demoSprint.startDate,
        baseline: demoSprint.snapshots[0].stories,
        latest: demoSprint.snapshots.at(-1)!.stories,
      },
    ],
    DEFAULT_SETTINGS,
  );
  return [...EARLIER.map((row, i) => ({ ...row, id: `demo-${7 + i}`, measured: true, running: false, averageScore: null, added: 0, addedBugs: 0 })), ...current];
}
