import { describe, expect, it } from "vitest";
import { mergeEdited, planSend, readBase, sameField, type JiraText } from "@/lib/stories/jira-merge";

const base: JiraText = {
  title: "Refund a payment",
  description: "As an agent I want to refund a payment so that the customer is paid back.",
  acceptanceCriteria: "- Full refunds\n- Partial refunds",
  storyPoints: 3,
};

describe("planSend: what Send to Jira writes", () => {
  it("sends only the fields edited here", () => {
    const here = { ...base, storyPoints: 5 };
    expect(planSend(here, base, base)).toEqual({ send: ["storyPoints"], conflicts: [] });
  });

  it("never sends an old field back over a newer edit in Jira", () => {
    // Points edited here on Monday; a developer rewrote the description in Jira on Tuesday.
    const here = { ...base, storyPoints: 5 };
    const jira = { ...base, description: "Rewritten in Jira." };
    expect(planSend(here, base, jira)).toEqual({ send: ["storyPoints"], conflicts: [] });
  });

  it("holds back a field changed in both places", () => {
    const here = { ...base, description: "Edited here." };
    const jira = { ...base, description: "Edited in Jira." };
    expect(planSend(here, base, jira)).toEqual({ send: [], conflicts: ["description"] });
    // The same change made in both places is no conflict, and nothing to send.
    expect(planSend(here, base, { ...jira, description: "Edited here." })).toEqual({ send: [], conflicts: [] });
  });

  it("with no base (stories from before v2.22), sends every field that differs", () => {
    const here = { ...base, title: "Refund a card payment" };
    expect(planSend(here, null, { ...base, storyPoints: 8 })).toEqual({ send: ["title", "storyPoints"], conflicts: [] });
  });

  it("compares criteria as the score reads them, wherever they're written", () => {
    const inDescription = { ...base, acceptanceCriteria: "", description: `${base.description}\n\nh3. Acceptance criteria\n* Full refunds\n* Partial refunds` };
    expect(sameField("acceptanceCriteria", base, inDescription)).toBe(true);
    expect(sameField("acceptanceCriteria", base, { ...base, acceptanceCriteria: "* Full refunds" })).toBe(false);
  });
});

describe("mergeEdited: Sync on a story edited here", () => {
  it("takes Jira's changes to fields not edited here, and keeps the edits", () => {
    const here = { ...base, storyPoints: 5 };
    const jira = { ...base, description: "Rewritten in Jira." };
    const merged = mergeEdited(here, base, jira);
    expect(merged.values).toEqual({ ...base, storyPoints: 5, description: "Rewritten in Jira." });
    expect(merged.base).toEqual(jira);
    expect(merged.edited).toBe(true);
  });

  it("is no longer edited once Jira has the same values", () => {
    const here = { ...base, storyPoints: 5 };
    const merged = mergeEdited(here, base, { ...base, storyPoints: 5 });
    expect(merged.edited).toBe(false);
    expect(merged.values.storyPoints).toBe(5);
  });

  it("leaves a story with no base as it is", () => {
    const here = { ...base, storyPoints: 5 };
    expect(mergeEdited(here, null, { ...base, description: "New" })).toEqual({ values: here, base: null, edited: true });
  });
});

describe("readBase", () => {
  it("reads a stored base and refuses anything else", () => {
    expect(readBase(base)).toEqual(base);
    expect(readBase({ ...base, storyPoints: null })).toEqual({ ...base, storyPoints: null });
    expect(readBase(null)).toBeNull();
    expect(readBase({ title: 1 })).toBeNull();
    expect(readBase([])).toBeNull();
  });
});
