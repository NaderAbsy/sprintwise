/** A story as it arrives from a paste or a CSV row, after parsing. */
export type Story = {
  key: string;
  title: string;
  description: string;
  /** Raw cell text: one criterion per line. */
  acceptanceCriteria: string;
  /** null = not estimated (blank or not a number). */
  storyPoints: number | null;
  status: string;
  /** Jira's issue type; blank means a story. Optional, since sprint snapshots don't keep it. */
  issueType?: string;
};

/** Matching key: trimmed and upper-cased, so " proj-12 " and "PROJ-12" are the same story. */
export function normalizeKey(key: string): string {
  return key.trim().toUpperCase();
}

/**
 * Splits the acceptance-criteria cell into criteria: one per line, with a
 * leading "-", "*", "•" or "1." / "1)" stripped and blank lines dropped.
 */
export function splitCriteria(cell: string): string[] {
  return cell
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0);
}

/**
 * Parses a story-points cell. Returns null for blank or invalid values;
 * `valid` is false only when something was written that isn't a number >= 0.
 */
export function parsePoints(raw: string | number | null | undefined): {
  points: number | null;
  valid: boolean;
} {
  if (raw === null || raw === undefined) return { points: null, valid: true };
  const text = String(raw).trim();
  if (text === "") return { points: null, valid: true };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return { points: null, valid: false };
  return { points: value, valid: true };
}
