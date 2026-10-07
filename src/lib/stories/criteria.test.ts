import { describe, expect, it } from "vitest";
import { scoreStory } from "@/lib/readiness/rules";
import { criteriaFromDescription, criteriaOf, splitCriteria, withCriteriaInDescription } from "@/lib/stories/types";

const story = (description: string, acceptanceCriteria = "") => ({
  key: "A-1",
  title: "Book a cleaner",
  description,
  acceptanceCriteria,
  storyPoints: 3,
  status: "To Do",
});

describe("criteria written inside the description", () => {
  it.each([
    ["a Jira heading", "As a parent I want to book a slot so that it fits my day.\n\nh3. Acceptance criteria\n* Slots for 14 days\n* Confirms in 5 seconds"],
    ["Jira bold", "As a parent I want to book a slot so that it fits my day.\n\n*Acceptance criteria*\n* Slots for 14 days\n* Confirms in 5 seconds"],
    ["Markdown bold with a colon", "As a parent I want to book a slot so that it fits my day.\n**Acceptance Criteria:**\n- Slots for 14 days\n- Confirms in 5 seconds"],
    ["a Markdown heading", "As a parent I want to book a slot so that it fits my day.\n## Acceptance criteria\n1. Slots for 14 days\n2. Confirms in 5 seconds"],
    ["plain text with a colon", "As a parent I want to book a slot so that it fits my day.\nAcceptance criteria:\n# Slots for 14 days\n# Confirms in 5 seconds"],
  ])("finds them under %s", (_, description) => {
    expect(criteriaOf(story(description))).toEqual({ lines: ["Slots for 14 days", "Confirms in 5 seconds"], fromDescription: true });
  });

  it("stops at the next heading", () => {
    const description = "Intro.\nh3. Acceptance criteria\n* One\n* Two\nh3. Notes\nNot a criterion";
    expect(criteriaFromDescription(description)).toBe("* One\n* Two");
    expect(criteriaFromDescription("Intro.\n*Acceptance criteria*\n* One\n*Out of scope*\n* Not this")).toBe("* One");
  });

  it("prefers the story's own criteria, and finds nothing without a heading", () => {
    expect(criteriaOf(story("h3. Acceptance criteria\n* From the description", "- Own one"))).toEqual({ lines: ["Own one"], fromDescription: false });
    expect(criteriaOf(story("Just a description that mentions acceptance criteria in passing."))).toEqual({ lines: [], fromDescription: false });
  });

  it("counts them in the score (rules v5)", () => {
    const withSection = scoreStory(
      story("As a busy parent I want to book a cleaner for a time slot so that it fits my day.\n\nh3. Acceptance criteria\n* Free slots for 14 days are shown\n* Booking confirms within 5 seconds"),
    );
    expect(withSection.findings.map((f) => f.id)).not.toContain("C1");
    expect(withSection.score).toBe(100);
  });

  it("strips Jira's # and nested ** bullets", () => {
    expect(splitCriteria("# First\n** Nested\n#hashtag stays")).toEqual(["First", "Nested", "#hashtag stays"]);
  });
});

describe("Feature, the story type in Jira's newer templates", () => {
  it("is scored as a user story", () => {
    const bare = { ...story("Booking should be easy."), issueType: "Feature" };
    expect(scoreStory(bare).typeNote).toBeUndefined();
    expect(scoreStory(bare).findings.map((f) => f.id)).toContain("C2");
  });
});

describe("withCriteriaInDescription (Jira sites with no criteria field)", () => {
  it("adds a section at the end", () => {
    expect(withCriteriaInDescription("As a customer I want refunds so that I get money back.", "- Full refunds\n- Partial refunds")).toBe(
      "As a customer I want refunds so that I get money back.\n\nh3. Acceptance criteria\n* Full refunds\n* Partial refunds",
    );
    expect(withCriteriaInDescription("", "- One")).toBe("h3. Acceptance criteria\n* One");
  });

  it("replaces an existing section and keeps what follows it", () => {
    const description = "Intro.\n\nh3. Acceptance criteria\n* Old one\n* Old two\n\nh3. Notes\nKeep me";
    expect(withCriteriaInDescription(description, "- New one")).toBe("Intro.\n\nh3. Acceptance criteria\n* New one\n\nh3. Notes\nKeep me");
  });

  it("leaves the description alone when there are no criteria", () => {
    expect(withCriteriaInDescription("Intro.", "  ")).toBe("Intro.");
  });

  it("round-trips: what it writes is read back as the same criteria", () => {
    const written = withCriteriaInDescription("Intro.", "- Shows the last four digits\n- Asks for the CVC only");
    expect(criteriaOf({ description: written, acceptanceCriteria: "" })).toEqual({
      lines: ["Shows the last four digits", "Asks for the CVC only"],
      fromDescription: true,
    });
  });
});
