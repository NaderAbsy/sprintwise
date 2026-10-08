import { describe, expect, it } from "vitest";
import { readStoryForm, STORY_LIMITS } from "@/lib/stories/form";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("readStoryForm", () => {
  it("trims fields and parses points", () => {
    const { story, fieldErrors } = readStoryForm(form({ title: "  Refund  ", storyPoints: " 3 ", status: " Done " }));
    expect(fieldErrors).toEqual({});
    expect(story).toMatchObject({ title: "Refund", storyPoints: 3, status: "Done" });
  });

  it("requires a title", () => {
    expect(readStoryForm(form({ title: " " })).fieldErrors.title).toBe("Paste a story title to score.");
  });

  it("rejects every field over its limit", () => {
    const long = (n: number) => "x".repeat(n + 1);
    const { fieldErrors } = readStoryForm(
      form({
        key: long(STORY_LIMITS.key),
        title: long(STORY_LIMITS.title),
        description: long(STORY_LIMITS.description),
        acceptanceCriteria: long(STORY_LIMITS.acceptanceCriteria),
        status: long(STORY_LIMITS.status),
        storyPoints: String(STORY_LIMITS.points + 1),
      }),
    );
    expect(Object.keys(fieldErrors).sort()).toEqual(["acceptanceCriteria", "description", "key", "status", "storyPoints", "title"]);
  });

  it("rejects negative or non-numeric points", () => {
    expect(readStoryForm(form({ title: "A", storyPoints: "-1" })).fieldErrors.storyPoints).toBeDefined();
    expect(readStoryForm(form({ title: "A", storyPoints: "abc" })).fieldErrors.storyPoints).toBeDefined();
  });
});

describe("line breaks", () => {
  it("keeps \\n line breaks, whatever the form sent", () => {
    const data = new FormData();
    data.set("title", "Refund a booking");
    data.set("acceptanceCriteria", "- One\r\n- Two\r- Three");
    expect(readStoryForm(data).story.acceptanceCriteria).toBe("- One\n- Two\n- Three");
  });

  it("compares a saved story's text like the text box shows it", async () => {
    const { storyFieldValues } = await import("@/lib/stories/compare");
    expect(storyFieldValues({ acceptanceCriteria: "- One\r\n- Two", description: "a\r\nb" })).toMatchObject({ acceptanceCriteria: "- One\n- Two", description: "a\nb" });
  });
});
