import { normalizeKey, parsePoints, type Story } from "@/lib/stories/types";

/** Field limits for a pasted or edited story. CSV imports have their own file limits. */
export const STORY_LIMITS = { key: 50, title: 300, description: 5000, acceptanceCriteria: 5000, status: 50, points: 1000 };

export type StoryForm = { story: Omit<Story, "key">; rawKey: string; fieldErrors: Record<string, string> };

/**
 * Reads and checks the story fields from a form. Pure, so the browser's live
 * preview and the server action agree on every message.
 */
export function readStoryForm(data: FormData): StoryForm {
  const text = (name: string) => String(data.get(name) ?? "").trim();
  const fieldErrors: Record<string, string> = {};

  const title = text("title");
  if (title === "") fieldErrors.title = "Paste a story title to score.";
  else if (title.length > STORY_LIMITS.title) fieldErrors.title = `Keep the title under ${STORY_LIMITS.title} characters.`;

  const description = text("description");
  if (description.length > STORY_LIMITS.description) {
    fieldErrors.description = `Keep the description under ${STORY_LIMITS.description} characters.`;
  }
  const acceptanceCriteria = text("acceptanceCriteria");
  if (acceptanceCriteria.length > STORY_LIMITS.acceptanceCriteria) {
    fieldErrors.acceptanceCriteria = `Keep the acceptance criteria under ${STORY_LIMITS.acceptanceCriteria} characters.`;
  }
  const status = text("status");
  if (status.length > STORY_LIMITS.status) fieldErrors.status = `Keep the status under ${STORY_LIMITS.status} characters.`;

  const points = parsePoints(text("storyPoints"));
  if (!points.valid) fieldErrors.storyPoints = "Story points must be a number of 0 or more.";
  else if (points.points !== null && points.points > STORY_LIMITS.points) {
    fieldErrors.storyPoints = `Story points can't be more than ${STORY_LIMITS.points}.`;
  }

  const rawKey = text("key");
  if (rawKey !== "" && normalizeKey(rawKey).length > STORY_LIMITS.key) {
    fieldErrors.key = `Keep the key under ${STORY_LIMITS.key} characters.`;
  }

  return {
    story: { title, description, acceptanceCriteria, storyPoints: points.valid ? points.points : null, status },
    rawKey,
    fieldErrors,
  };
}
