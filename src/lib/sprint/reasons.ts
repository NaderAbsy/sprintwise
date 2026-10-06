import type { ChangeType } from "@/lib/sprint/diff";

/** Why scope changed mid-sprint. The PO tags each scope change; the report sums them. */
export const REASONS = [
  { id: "bug", label: "Bug or incident", phrase: "bugs and incidents" },
  { id: "stakeholder", label: "Stakeholder request", phrase: "stakeholder requests" },
  { id: "discovered", label: "Discovered work", phrase: "work discovered mid-sprint" },
  { id: "tech-debt", label: "Tech debt", phrase: "tech debt" },
  { id: "other", label: "Other", phrase: "other reasons" },
] as const;

export type ReasonId = (typeof REASONS)[number]["id"];

export const isReason = (value: unknown): value is ReasonId => REASONS.some((r) => r.id === value);
export const reasonLabel = (id: string | null | undefined) => REASONS.find((r) => r.id === id)?.label ?? "Not tagged";

export const GOAL_OUTCOMES = [
  { id: "met", label: "Met" },
  { id: "partly", label: "Partly met" },
  { id: "missed", label: "Missed" },
] as const;

export type GoalOutcome = (typeof GOAL_OUTCOMES)[number]["id"];
export const isGoalOutcome = (value: unknown): value is GoalOutcome => GOAL_OUTCOMES.some((o) => o.id === value);

export type ReasonSummaryRow = { id: ReasonId | null; label: string; points: number; count: number; share: number };

/**
 * Points of scope change per reason, largest first. Each change counts by the
 * size of its effect (|points delta|), so +3 and −3 both count as 3 points moved.
 * Changes that move no points still count towards `count`.
 */
export function summarizeReasons(changes: { type: ChangeType; pointsDelta: number; reason?: string | null }[]): {
  rows: ReasonSummaryRow[];
  untagged: number;
  totalPoints: number;
} {
  const totals = new Map<ReasonId | null, { points: number; count: number }>();
  for (const change of changes) {
    const id = isReason(change.reason) ? change.reason : null;
    const entry = totals.get(id) ?? { points: 0, count: 0 };
    entry.points += Math.abs(change.pointsDelta);
    entry.count += 1;
    totals.set(id, entry);
  }
  const totalPoints = [...totals.values()].reduce((sum, t) => sum + t.points, 0);
  const rows = [...totals]
    .map(([id, t]) => ({
      id,
      label: reasonLabel(id),
      points: t.points,
      count: t.count,
      share: totalPoints === 0 ? 0 : t.points / totalPoints,
    }))
    .sort((a, b) => b.points - a.points || b.count - a.count);
  return { rows, untagged: totals.get(null)?.count ?? 0, totalPoints };
}

/** One sentence for the report, or null when nothing is tagged. */
export function reasonFinding(summary: ReturnType<typeof summarizeReasons>): string | null {
  const top = summary.rows.find((r) => r.id !== null);
  if (!top || summary.totalPoints === 0) return null;
  const phrase = REASONS.find((r) => r.id === top.id)?.phrase ?? top.label.toLowerCase();
  return `${Math.round(top.share * 100)}% of the scope that moved came from ${phrase}.`;
}
