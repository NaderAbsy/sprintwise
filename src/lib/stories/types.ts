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
    .map((line) => line.replace(/^\s*(?:[-*•#]+(?=\s)|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0);
}

/**
 * Whether a line starts an acceptance-criteria section inside a description, as
 * teams without a separate Jira field write it: "h3. Acceptance criteria",
 * "*Acceptance criteria*", "**Acceptance Criteria:**", "## Acceptance criteria",
 * "Acceptance criteria:" or "AC:". The line is tidied and compared rather than
 * matched with one big pattern: that pattern, with optional spaces between each
 * part, took minutes on a line of spaces.
 */
function isCriteriaHeading(line: string): boolean {
  if (line.length > 200) return false;
  const words = line
    .trim()
    .replace(/^(?:h[1-6]\.|#{1,6})/i, "")
    .replace(/[\s:*_]+/g, " ")
    .trim()
    .toLowerCase();
  return words === "acceptance criteria" || words === "ac";
}
/** The heading of the next section, which ends the criteria. Bullets ("* item") don't count. */
const NEXT_HEADING = /^\s*(?:h[1-6]\.\s|#{1,6}\s|[*_]{1,2}[^*_\n]{1,60}[*_]{1,2}\s*:?\s*$|[A-Z][^.\n]{0,40}:\s*$)/;

/** The text under a description's "Acceptance criteria" heading, up to the next heading; "" if there's none. */
export function criteriaFromDescription(description: string): string {
  const lines = description.split(/\r?\n/);
  const start = lines.findIndex(isCriteriaHeading);
  if (start < 0) return "";
  const section: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (NEXT_HEADING.test(line) && !/^\s*[-*•#]+\s/.test(line)) break;
    section.push(line);
  }
  return section.join("\n").trim();
}

/**
 * A story's acceptance criteria: its own field, or, when that's empty, the
 * "Acceptance criteria" section of its description (common in Jira projects
 * with no separate field).
 */
export function criteriaOf(story: Pick<Story, "acceptanceCriteria" | "description">): { lines: string[]; fromDescription: boolean } {
  const own = splitCriteria(story.acceptanceCriteria);
  if (own.length > 0) return { lines: own, fromDescription: false };
  const found = splitCriteria(criteriaFromDescription(story.description));
  return { lines: found, fromDescription: found.length > 0 };
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

/**
 * A description with the given criteria as its "Acceptance criteria" section,
 * for Jira sites with no criteria field: the existing section is replaced, or a
 * new one is added at the end. Bullets are Jira's "* ".
 */
export function withCriteriaInDescription(description: string, criteria: string): string {
  const bullets = splitCriteria(criteria).map((c) => `* ${c}`).join("\n");
  if (!bullets) return description;
  const lines = description.split(/\r?\n/);
  const start = lines.findIndex(isCriteriaHeading);
  if (start < 0) return `${description.trimEnd()}${description.trim() ? "\n\n" : ""}h3. Acceptance criteria\n${bullets}`;
  let end = start + 1;
  while (end < lines.length && !(NEXT_HEADING.test(lines[end]) && !/^\s*[-*•#]+\s/.test(lines[end]))) end++;
  return [...lines.slice(0, start + 1), bullets, ...(end < lines.length ? ["", ...lines.slice(end)] : [])].join("\n");
}
