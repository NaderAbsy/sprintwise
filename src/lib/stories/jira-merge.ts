import { criteriaOf, type Story } from "@/lib/stories/types";

/**
 * The fields Sprintwise and Jira both edit. Sprintwise keeps them as Jira last
 * gave them (`base`), so a story's own values, the base and Jira's values now can
 * be compared field by field: an edit here, a change in Jira, or both.
 */
export const JIRA_FIELDS = ["title", "description", "acceptanceCriteria", "storyPoints"] as const;
export type JiraField = (typeof JIRA_FIELDS)[number];
export type JiraText = Pick<Story, JiraField>;

export const FIELD_NAMES: Record<JiraField, string> = {
  title: "title",
  description: "description",
  acceptanceCriteria: "acceptance criteria",
  storyPoints: "story points",
};

export function baseOf(story: JiraText): JiraText {
  return { title: story.title, description: story.description, acceptanceCriteria: story.acceptanceCriteria, storyPoints: story.storyPoints };
}

/** A stored base, or null if it's missing or not in the expected shape. */
export function readBase(value: unknown): JiraText | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const texts = ["title", "description", "acceptanceCriteria"] as const;
  if (!texts.every((f) => typeof v[f] === "string")) return null;
  if (v.storyPoints !== null && typeof v.storyPoints !== "number") return null;
  return baseOf(v as unknown as JiraText);
}

const clean = (text: string) => text.replace(/\r\n?/g, "\n").trim();

/**
 * Whether two versions agree on a field. Criteria are compared as the list the
 * score reads, so criteria kept in the description (sites with no criteria field)
 * match the same criteria in the criteria box.
 */
export function sameField(field: JiraField, a: JiraText, b: JiraText): boolean {
  if (field === "storyPoints") return a.storyPoints === b.storyPoints;
  if (field === "acceptanceCriteria") return criteriaOf(a).lines.join("\n") === criteriaOf(b).lines.join("\n");
  return clean(a[field]) === clean(b[field]);
}

/**
 * Sync for a story edited here: each field Jira changed and this story didn't
 * takes Jira's value; a field edited here keeps the edit. `edited` says whether
 * any edit is still waiting to be sent. With no base (stories imported before
 * Sprintwise kept one), nothing can be told apart, so the story stays as it is.
 */
export function mergeEdited(here: JiraText, base: JiraText | null, jira: JiraText): { values: JiraText; base: JiraText | null; edited: boolean } {
  if (!base) return { values: baseOf(here), base: null, edited: true };
  const values = baseOf(here);
  const next = baseOf(base);
  for (const field of JIRA_FIELDS) {
    // Not edited here, or Jira now says the same: Jira's version is the one to keep.
    if (sameField(field, here, base) || sameField(field, here, jira)) {
      (values as Record<JiraField, unknown>)[field] = jira[field];
      (next as Record<JiraField, unknown>)[field] = jira[field];
    }
  }
  return { values, base: next, edited: JIRA_FIELDS.some((f) => !sameField(f, values, next)) };
}

/**
 * What Send to Jira should write: the fields edited here. A field changed in
 * Jira as well since Sprintwise last read it is a conflict: sending would
 * overwrite someone's work, so it isn't sent. With no base, every field that
 * differs from Jira is sent, as before Sprintwise kept one.
 */
export function planSend(here: JiraText, base: JiraText | null, jira: JiraText): { send: JiraField[]; conflicts: JiraField[] } {
  const send: JiraField[] = [];
  const conflicts: JiraField[] = [];
  for (const field of JIRA_FIELDS) {
    if (sameField(field, here, jira)) continue;
    if (base && sameField(field, here, base)) continue;
    if (base && !sameField(field, jira, base)) conflicts.push(field);
    else send.push(field);
  }
  return { send, conflicts };
}
