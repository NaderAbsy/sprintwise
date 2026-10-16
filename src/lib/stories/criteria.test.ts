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

  it("ends a list at a paragraph after a blank line, but not plain criteria with blank lines (rules v6)", () => {
    expect(criteriaFromDescription("h3. Acceptance criteria\n* One\n* Two\n\nDesign notes are in Figma.")).toBe("* One\n* Two");
    expect(criteriaFromDescription("h3. Acceptance criteria\n* One\n\n* Two")).toBe("* One\n\n* Two");
    expect(criteriaFromDescription("Acceptance criteria:\nGiven a slot\n\nWhen I book it\n\nThen it's mine")).toBe(
      "Given a slot\n\nWhen I book it\n\nThen it's mine",
    );
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

  it("keeps code, tables, panels and notes after the section (v2.22)", () => {
    const description =
      "Intro.\nh3. Acceptance criteria\n* Old one\n\n{code}GET /cards/{id}{code}\n\n||Field||Rule||\n|cvc|3 digits|\n\n{info}Rollout in May{info}";
    expect(withCriteriaInDescription(description, "- New one")).toBe(
      "Intro.\nh3. Acceptance criteria\n* New one\n\n{code}GET /cards/{id}{code}\n\n||Field||Rule||\n|cvc|3 digits|\n\n{info}Rollout in May{info}",
    );
    expect(withCriteriaInDescription("Intro.\nh3. Acceptance criteria\n* Old\n\nDesign notes are in Figma.", "- New")).toBe(
      "Intro.\nh3. Acceptance criteria\n* New\n\nDesign notes are in Figma.",
    );
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

describe("hostile text", () => {
  it("reads a line of thousands of spaces after AC at once", () => {
    const description = `AC${" ".repeat(5000)}x\n- One`;
    const start = performance.now();
    expect(criteriaOf({ description, acceptanceCriteria: "" }).lines).toEqual([]);
    expect(performance.now() - start).toBeLessThan(50);
  });
});

describe("criteria sections from a real Jira Cloud site", () => {
  it("end at a code sample, panel or table, which aren't criteria", () => {
    const description =
      "h2. Acceptance Criteria\n\n* Saved cards list the last four digits\n** Expired cards are greyed out\n* Paying asks for the CVC only\n\n{code:json}{ \"card\": \"tok_123\" }{code}";
    expect(criteriaOf(story(description)).lines).toEqual(["Saved cards list the last four digits", "Expired cards are greyed out", "Paying asks for the CVC only"]);
    expect(splitCriteria(criteriaFromDescription("*Acceptance criteria*\n* One\n{panel}\nNote\n{panel}"))).toEqual(["One"]);
  });

  it("score a story whose criteria are a Jira numbered list as Ready", () => {
    const r = scoreStory({
      key: "SCRUM-18",
      title: "Choose a cleaner by rating",
      description:
        "As a new customer I want to choose a cleaner by rating so that I pick one with many reviews.\n\n*Acceptance Criteria:*\n\n# Given I search, when results load, then they are sorted by rating\n# Given two cleaners tie, when sorted, then the one with more reviews comes first",
      acceptanceCriteria: "",
      storyPoints: 8,
      status: "Idea",
      issueType: "Feature",
    });
    expect(r.band).toBe("Ready");
  });
});
