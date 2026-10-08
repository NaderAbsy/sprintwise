import { scoreStory, type RuleSettings } from "@/lib/readiness/rules";
import { computeMetrics, DONE_STATUSES } from "@/lib/sprint/metrics";
import type { Story } from "@/lib/stories/types";

export type SprintTrendInput = {
  id: string;
  name: string;
  startDate: Date;
  baseline: Story[];
  latest: Story[];
  /** False while only the baseline exists: nothing has been measured yet. */
  measured?: boolean;
  /** True until the sprint's last day: its numbers are still moving, so averages leave it out. */
  running?: boolean;
};

export type SprintTrendRow = {
  id: string;
  /** Has later snapshots and has ended; only these count in averages and charts. */
  measured: boolean;
  running: boolean;
  name: string;
  startDate: Date;
  committed: number;
  done: number;
  completion: number | null;
  churn: number | null;
  netChange: number | null;
  /** Share of baseline stories that were Ready when the sprint was committed. */
  readyAtBaseline: number | null;
  averageScore: number | null;
};

/** One row per sprint that has a baseline, oldest first. */
export function trendRows(
  sprints: SprintTrendInput[],
  settings: RuleSettings,
  doneStatuses: readonly string[] = DONE_STATUSES,
): SprintTrendRow[] {
  return [...sprints]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((s) => {
      const m = computeMetrics(s.baseline, s.latest, doneStatuses);
      const scores = s.baseline.map((story) => scoreStory(story, settings));
      return {
        id: s.id,
        measured: (s.measured ?? true) && !s.running,
        running: s.running ?? false,
        name: s.name,
        startDate: s.startDate,
        committed: m.baselineTotal,
        done: m.donePoints,
        completion: m.completion,
        churn: m.churn,
        netChange: m.netChange,
        readyAtBaseline: scores.length === 0 ? null : scores.filter((r) => r.band === "Ready").length / scores.length,
        averageScore: scores.length === 0 ? null : scores.reduce((sum, r) => sum + r.score, 0) / scores.length,
      };
    });
}

const mean = (values: number[]) => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);

/** Average points done over the last `n` sprints with a later snapshot: a planning guide, not a target. */
export function averageVelocity(rows: SprintTrendRow[], n = 3): { points: number; sprints: number } | null {
  const recent = rows.filter((r) => r.measured).slice(-n);
  const value = mean(recent.map((r) => r.done));
  return value === null ? null : { points: Math.round(value * 10) / 10, sprints: recent.length };
}

export type TrendSummary = {
  velocity: { points: number; sprints: number } | null;
  completion: number | null;
  churn: number | null;
  readyAtBaseline: number | null;
  /** Plain-English observations, only when there are enough sprints to compare. */
  insights: string[];
  /**
   * What the insights compare: the latest sprint with the one before (2–3 sprints),
   * or the last three with the ones before (4 or more). Null when there are none.
   */
  basis: "previous" | "trend" | null;
};

/** Averages over the last three sprints, and what changed against the ones before. */
export function summarizeTrends(allRows: SprintTrendRow[]): TrendSummary {
  const rows = allRows.filter((r) => r.measured);
  const recent = rows.slice(-3);
  const avg = (pick: (r: SprintTrendRow) => number | null, list = recent) =>
    mean(list.map(pick).filter((v): v is number => v !== null));
  const insights: string[] = [];

  // With two or three sprints, compare the latest with the one before; from four, compare averages.
  if (rows.length >= 2 && rows.length < 4) {
    const [before, after] = rows.slice(-2);
    const compare = (label: string, pick: (r: SprintTrendRow) => number | null, higherIsBetter: boolean) => {
      const a = pick(before);
      const b = pick(after);
      if (a === null || b === null) return;
      const diff = Math.round((b - a) * 100);
      if (Math.abs(diff) < 5) return;
      const better = diff > 0 === higherIsBetter;
      insights.push(
        `${label} ${diff > 0 ? "rose" : "fell"} from ${Math.round(a * 100)}% to ${Math.round(b * 100)}% since ${before.name}${better ? ", a good sign." : "."}`,
      );
    };
    compare("Completion", (r) => r.completion, true);
    compare("Churn", (r) => r.churn, false);
    compare("Stories Ready at planning", (r) => r.readyAtBaseline, true);
  }

  if (rows.length >= 4) {
    const earlier = rows.slice(0, -3);
    const compare = (label: string, pick: (r: SprintTrendRow) => number | null, higherIsBetter: boolean) => {
      const before = avg(pick, earlier);
      const after = avg(pick);
      if (before === null || after === null) return;
      const diff = Math.round((after - before) * 100);
      if (Math.abs(diff) < 5) return;
      const better = diff > 0 === higherIsBetter;
      insights.push(
        // An average, not the latest sprint: say so, or a sharp drop in the last sprint reads as a contradiction.
        `${label} averaged ${Math.abs(diff)} points ${diff > 0 ? "higher" : "lower"} over the last 3 sprints than before${better ? ", a good sign." : "."}`,
      );
    };
    compare("Completion", (r) => r.completion, true);
    compare("Churn", (r) => r.churn, false);
    compare("Stories Ready at planning", (r) => r.readyAtBaseline, true);
  }

  // Did sprints that started more Ready finish more of their commitment?
  const paired = rows.filter((r) => r.readyAtBaseline !== null && r.completion !== null);
  if (paired.length >= 3) {
    const sorted = [...paired].sort((a, b) => a.readyAtBaseline! - b.readyAtBaseline!);
    const half = Math.floor(sorted.length / 2);
    const low = avg((r) => r.completion, sorted.slice(0, half));
    const high = avg((r) => r.completion, sorted.slice(-half));
    if (low !== null && high !== null && Math.round((high - low) * 100) >= 5) {
      insights.push(
        `Sprints that started with more Ready stories finished ${Math.round((high - low) * 100)} points more of their commitment.`,
      );
    }
  }

  return {
    velocity: averageVelocity(rows),
    completion: avg((r) => r.completion),
    churn: avg((r) => r.churn),
    readyAtBaseline: avg((r) => r.readyAtBaseline),
    insights,
    basis: insights.length === 0 ? null : rows.length < 4 ? "previous" : "trend",
  };
}
