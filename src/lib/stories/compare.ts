export type StoryDefaults = {
  title?: string;
  description?: string;
  acceptanceCriteria?: string;
  storyPoints?: number | null;
  status?: string;
  issueType?: string;
};

/** Field names as the form sends them. */
export type StoryFieldName = "title" | "description" | "acceptanceCriteria" | "storyPoints" | "status" | "issueType";

/** When editing a saved story: what it said before, and what the fields hold now, to mark changes. */
export type StoryCompare = { before: Record<StoryFieldName, string>; current: Record<StoryFieldName, string> };

/** The saved values as the form would show them, so "changed" compares like with like. */
export function storyFieldValues(story: StoryDefaults): Record<StoryFieldName, string> {
  // A text box always holds "\n" line breaks; text saved from a form or a file may have "\r\n".
  const lines = (text: string | undefined) => (text ?? "").replace(/\r\n?/g, "\n");
  return {
    title: story.title ?? "",
    description: lines(story.description),
    acceptanceCriteria: lines(story.acceptanceCriteria),
    storyPoints: story.storyPoints === null || story.storyPoints === undefined ? "" : String(story.storyPoints),
    status: story.status ?? "",
    issueType: story.issueType ?? "",
  };
}
