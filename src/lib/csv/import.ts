import { z } from "zod";
import { storyProblems } from "@/lib/csv/parse";
import { IMPORT_FIELDS, IMPORT_MAX_STORIES, type ColumnMapping } from "@/lib/csv/template";
import { isDone } from "@/lib/sprint/metrics";
import { isEpic, isSubtask, normalizeKey, type Story } from "@/lib/stories/types";

export type ImportStory = Story & { epic: string };

const storySchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.string(),
  storyPoints: z.number().finite().min(0).nullable(),
  status: z.string(),
  issueType: z.string().default(""),
  epic: z.string(),
});

const fieldNames = IMPORT_FIELDS.map((f) => f.field) as [string, ...string[]];
const mappingSchema = z.partialRecord(z.enum(fieldNames), z.string().max(300).nullable());

/**
 * Checks the stories the browser picked from a CSV before they're saved. The
 * browser already read and checked the file; this repeats every check, since
 * anything can be sent to a server action.
 */
export function readImportPayload(
  storiesJson: unknown,
  mappingJson: unknown,
): { ok: true; stories: ImportStory[]; mapping: ColumnMapping } | { ok: false; error: string } {
  let raw: unknown;
  let rawMapping: unknown;
  try {
    raw = JSON.parse(typeof storiesJson === "string" ? storiesJson : "");
    rawMapping = typeof mappingJson === "string" && mappingJson !== "" ? JSON.parse(mappingJson) : {};
  } catch {
    return { ok: false, error: "Choose a CSV file and tick the stories to import." };
  }

  const list = z.array(storySchema).safeParse(raw);
  if (!list.success) return { ok: false, error: "The stories sent weren't in the expected shape. Reload the page and try again." };
  if (list.data.length === 0) return { ok: false, error: "Tick at least one story to import." };
  if (list.data.length > IMPORT_MAX_STORIES) {
    return { ok: false, error: `Import up to ${IMPORT_MAX_STORIES} stories at a time; ${list.data.length} are ticked.` };
  }
  const mapping = mappingSchema.safeParse(rawMapping);

  const seen = new Set<string>();
  const stories: ImportStory[] = [];
  for (const item of list.data) {
    const story: ImportStory = {
      key: normalizeKey(item.key),
      title: item.title.trim(),
      description: item.description.trim(),
      acceptanceCriteria: item.acceptanceCriteria.trim(),
      storyPoints: item.storyPoints,
      status: item.status.trim(),
      issueType: item.issueType.trim(),
      epic: item.epic.trim(),
    };
    const problems = storyProblems(story, story.epic);
    if (problems.length > 0) return { ok: false, error: `${story.key || "A story"}: ${problems.join(" ")}` };
    if (seen.has(story.key)) return { ok: false, error: `${story.key} is ticked twice.` };
    seen.add(story.key);
    stories.push(story);
  }
  return { ok: true, stories, mapping: mapping.success ? (mapping.data as ColumnMapping) : {} };
}

/** The story field each optional import column fills. */
const COLUMN_FIELDS = {
  description: "description",
  acceptance_criteria: "acceptanceCriteria",
  story_points: "storyPoints",
  status: "status",
  epic: "epic",
  issue_type: "issueType",
} as const;
export type ImportedField = "title" | (typeof COLUMN_FIELDS)[keyof typeof COLUMN_FIELDS];

/**
 * The columns the file had (import fields, as the browser matched them), as the
 * story fields they fill; undefined when not sent, which means all of them. A
 * story already saved keeps the fields the file has no column for.
 */
export function readImportedFields(json: unknown): Set<ImportedField> | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(typeof json === "string" ? json : "");
  } catch {
    return undefined;
  }
  if (!Array.isArray(raw)) return undefined;
  const fields = new Set<ImportedField>(["title"]);
  for (const column of raw) {
    if (typeof column === "string" && Object.hasOwn(COLUMN_FIELDS, column)) fields.add(COLUMN_FIELDS[column as keyof typeof COLUMN_FIELDS]);
  }
  return fields;
}

/** Keys a Jira import showed but didn't tick, so Sync doesn't add them later. At most 2,000, each a plausible key. */
export function readLeftOut(json: unknown): string[] {
  let raw: unknown;
  try {
    raw = JSON.parse(typeof json === "string" ? json : "");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const keys = raw.filter((k): k is string => typeof k === "string" && k.length <= 60).map(normalizeKey).filter(Boolean);
  return [...new Set(keys)].slice(0, 2000);
}

/**
 * Whether a story from a file or Jira starts ticked for import, and whether Sync
 * adds it when it's new: not finished, and not an epic or a sub-task, which
 * aren't planned on their own. One rule for both, so they can't drift apart.
 */
export function wantedByDefault(story: Pick<Story, "status" | "issueType">, doneStatuses: string[]): boolean {
  return !isDone(story.status, doneStatuses) && !isEpic(story.issueType) && !isSubtask(story.issueType);
}
