export type StoryDefaults = {
  title?: string;
  description?: string;
  acceptanceCriteria?: string;
  storyPoints?: number | null;
  status?: string;
};

/** Field names as the form sends them. */
export type StoryFieldName = "title" | "description" | "acceptanceCriteria" | "storyPoints" | "status";

/** When editing a saved story: what it said before, and what the fields hold now, to mark changes. */
export type StoryCompare = { before: Record<StoryFieldName, string>; current: Record<StoryFieldName, string> };

/** The saved values as the form would show them, so "changed" compares like with like. */
export function storyFieldValues(story: StoryDefaults): Record<StoryFieldName, string> {
  return {
    title: story.title ?? "",
    description: story.description ?? "",
    acceptanceCriteria: story.acceptanceCriteria ?? "",
    storyPoints: story.storyPoints === null || story.storyPoints === undefined ? "" : String(story.storyPoints),
    status: story.status ?? "",
  };
}
