import { z } from "zod";
import { storyProblems } from "@/lib/csv/parse";
import { IMPORT_FIELDS, IMPORT_MAX_STORIES, type ColumnMapping } from "@/lib/csv/template";
import { normalizeKey, type Story } from "@/lib/stories/types";

export type ImportStory = Story & { epic: string };

const storySchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.string(),
  storyPoints: z.number().finite().min(0).nullable(),
  status: z.string(),
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
