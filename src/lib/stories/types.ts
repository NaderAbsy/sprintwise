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
  // Invisible characters (zero-width spaces, direction marks) come along when a key is copied from some tools;
  // kept, "ABC-1" and "ABC-1" with one would look the same but be two stories.
  return key.normalize("NFC").replace(/\p{Cf}/gu, "").trim().toUpperCase();
}

/**
 * Splits the acceptance-criteria cell into criteria: one per line, with a
 * leading "-", "*", "•" or "1." / "1)" stripped and blank lines dropped.
 */
export function splitCriteria(cell: string): string[] {
  return (
    cell
      .split(/\r?\n/)
      // A list number needs a space after it, so "2.5 MB is the limit" keeps its "2.".
      .map((line) => line.replace(/^\s*(?:[-*•#]+|\d+[.)])(?=\s|$)\s*/, "").trim())
      // An empty bullet ("-", "* ", a "----" rule) isn't a criterion.
      .filter((line) => /[\p{L}\p{N}]/u.test(line))
  );
}

/**
 * Whether a line starts an acceptance-criteria section inside a description, as
 * teams without a separate Jira field write it: "h3. Acceptance criteria",
 * "*Acceptance criteria*", "**Acceptance Criteria:**", "## Acceptance criteria",
 * "Acceptance criteria:" or "AC:". The line is tidied and compared rather than
 * matched with one big pattern: that pattern, with optional spaces between each
 * part, took minutes on a line of spaces.
 */
export function isCriteriaHeading(line: string): boolean {
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
/** A code sample, panel, table or rule after the criteria ends the section: it isn't a criterion. */
const BLOCK_START = /^\s*(?:\{(?:code|noformat|panel|info|note|tip|warning|quote|expand)\b|\|\||-{4,}\s*$)/i;

const LIST_LINE = /^\s*(?:[-*\u2022#]+|\d+[.)])\s/;

/**
 * Where the "Acceptance criteria" section of a description's lines starts (its
 * heading) and ends (the first line after it): at the next heading; at a code
 * sample, panel, table or rule; or, once the section has had list items, at a
 * paragraph after a blank line, such as a note under the list. Reading the
 * criteria and writing them back both use this, so a send never touches what
 * the score didn't read as criteria.
 */
function criteriaSection(lines: string[]): { start: number; end: number } | null {
  const start = lines.findIndex(isCriteriaHeading);
  if (start < 0) return null;
  let listed = false;
  let end = start + 1;
  for (; end < lines.length; end++) {
    const line = lines[end];
    if (BLOCK_START.test(line)) break;
    if (NEXT_HEADING.test(line) && !/^\s*[-*\u2022#]+\s/.test(line)) break;
    if (listed && lines[end - 1].trim() === "" && line.trim() !== "" && !LIST_LINE.test(line)) break;
    if (LIST_LINE.test(line)) listed = true;
  }
  // Blank lines before what ends the section aren't part of it.
  while (end > start + 1 && lines[end - 1].trim() === "") end--;
  return { start, end };
}

/** The description without its "Acceptance criteria" section (heading included), for rules about the story itself. */
export function withoutCriteriaSection(description: string): string {
  const lines = description.split(/\r?\n/);
  const section = criteriaSection(lines);
  return section ? [...lines.slice(0, section.start), ...lines.slice(section.end)].join("\n") : description;
}

/** The text under a description's "Acceptance criteria" heading, up to where the section ends; "" if there's none. */
export function criteriaFromDescription(description: string): string {
  const lines = description.split(/\r?\n/);
  const section = criteriaSection(lines);
  return section ? lines.slice(section.start + 1, section.end).join("\n").trim() : "";
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
  // "1,5" is how much of Europe writes 1.5, and the only decimal key on many phones there.
  const text = String(raw).trim().replace(/^(\d+),(\d+)$/, "$1.$2");
  if (text === "") return { points: null, valid: true };
  // Digits with one optional decimal point: Number() would also take "0x10", "1e3" and "Infinity".
  if (!/^\d+(?:\.\d+)?$/.test(text)) return { points: null, valid: false };
  const value = Number(text);
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
  const section = criteriaSection(lines);
  if (!section) return `${description.trimEnd()}${description.trim() ? "\n\n" : ""}h3. Acceptance criteria\n${bullets}`;
  const rest = lines.slice(section.end);
  return [...lines.slice(0, section.start + 1), bullets, ...(rest.length > 0 ? (rest[0].trim() === "" ? rest : ["", ...rest]) : [])].join("\n");
}

/** Epics group stories; they're never planned into a sprint, so imports and syncs leave them out unless asked. */
export function isEpic(issueType: string | undefined): boolean {
  return issueType?.trim().toLowerCase() === "epic";
}

/** Sub-tasks are steps inside a story, not planned on their own, so they're left out the same way. */
export function isSubtask(issueType: string | undefined): boolean {
  return /^sub[- ]?task$/i.test(issueType?.trim() ?? "");
}
