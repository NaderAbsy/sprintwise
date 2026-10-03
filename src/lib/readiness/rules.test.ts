import { describe, expect, it } from "vitest";
import {
  bandFor,
  findVagueWords,
  readySummary,
  RULES,
  DEFAULT_SETTINGS,
  scoreStory,
  type RuleId,
} from "@/lib/readiness/rules";
import { story } from "@/test/story";

const failed = (s: ReturnType<typeof scoreStory>) => s.rules.filter((r) => !r.passed).map((r) => r.id);
const rule = (s: ReturnType<typeof scoreStory>, id: RuleId) => s.rules.find((r) => r.id === id)!;

describe("rules table", () => {
  it("weights total 100", () => {
    expect(RULES.reduce((sum, r) => sum + r.points, 0)).toBe(100);
  });
});

describe("scoreStory", () => {
  it("gives a complete story 100 and Ready", () => {
    const result = scoreStory(story());
    expect(result.score).toBe(100);
    expect(result.band).toBe("Ready");
    expect(failed(result)).toEqual([]);
  });

  it("is deterministic", () => {
    expect(scoreStory(story({ storyPoints: null }))).toEqual(scoreStory(story({ storyPoints: null })));
  });

  it("C1 fails with no criteria, and C3 fails with it", () => {
    const result = scoreStory(story({ acceptanceCriteria: "  \n - \n" }));
    expect(failed(result)).toEqual(["C1", "C3"]);
    expect(result.score).toBe(65);
    expect(rule(result, "C3").reason).toMatch(/No acceptance criteria/);
  });

  it("C2 accepts the format in the title or the description", () => {
    const inTitle = story({
      title: "As a PO I want a score so that I know what's ready",
      description: "Shows a number out of 100 for each story.",
    });
    expect(rule(scoreStory(inTitle), "C2").passed).toBe(true);
    expect(rule(scoreStory(story()), "C2").passed).toBe(true);
  });

  it("C2 needs the parts in order, with whole words", () => {
    const outOfOrder = story({ description: "So that I can email it, I want PDFs, as a finance admin." });
    expect(rule(scoreStory(outOfOrder), "C2").passed).toBe(false);
    const glued = story({ description: "Has a wantlist so thatcher can read it as aside" });
    expect(rule(scoreStory(glued), "C2").passed).toBe(false);
  });

  it("C3 fails when a criterion is vague, naming the word", () => {
    const result = scoreStory(story({ acceptanceCriteria: "- Export is fast\n- PDF matches" }));
    expect(failed(result)).toEqual(["C3"]);
    expect(rule(result, "C3").reason).toContain('"fast"');
  });

  it("C4 fails when 'so that' is missing or empty", () => {
    const missing = scoreStory(story({ description: "As a finance admin I want to export invoices as PDF files." }));
    expect(failed(missing)).toEqual(["C2", "C4"]);
    const empty = scoreStory(story({ description: "As a finance admin I want to export an invoice so that  ." }));
    expect(rule(empty, "C4").passed).toBe(false);
    expect(rule(empty, "C4").reason).toMatch(/empty/);
  });

  it("C5 matches whole words, ignoring case", () => {
    expect(findVagueWords("Make it FAST", ["fast"])).toEqual(["fast"]);
    expect(findVagueWords("Breakfast menu", ["fast"])).toEqual([]);
    expect(findVagueWords("A user-friendly form, etc.", ["user-friendly", "etc", "friendly"])).toEqual([
      "user-friendly",
      "etc",
    ]);
    expect(findVagueWords("Send it as needed", ["as needed"])).toEqual(["as needed"]);
    const result = scoreStory(story({ title: "Fast, intuitive PDF export" }));
    expect(failed(result)).toEqual(["C5"]);
    expect(rule(result, "C5").reason).toContain('"fast", "intuitive"');
  });

  it("C6 and C7 fail when points are missing", () => {
    const result = scoreStory(story({ storyPoints: null }));
    expect(failed(result)).toEqual(["C6", "C7"]);
    expect(result.score).toBe(80);
  });

  it("C7 uses the max points setting, inclusive", () => {
    expect(rule(scoreStory(story({ storyPoints: 8 })), "C7").passed).toBe(true);
    expect(rule(scoreStory(story({ storyPoints: 13 })), "C7").passed).toBe(false);
    expect(rule(scoreStory(story({ storyPoints: 13 }), { maxPoints: 13, vagueWords: [] }), "C7").passed).toBe(true);
    expect(rule(scoreStory(story({ storyPoints: 0 })), "C6").passed).toBe(true);
  });

  it("C8 fails on two wants or 'and also'", () => {
    const twoWants = story({ description: "As an admin I want to export PDFs and I want to email them so that clients get invoices" });
    expect(failed(scoreStory(twoWants))).toEqual(["C8"]);
    const andAlso = story({ description: "As an admin I want to export PDFs and also email them so that clients get invoices" });
    expect(rule(scoreStory(andAlso), "C8").reason).toMatch(/and also/);
  });

  it("C9 needs a description of at least 20 characters", () => {
    const short = scoreStory(story({ title: "As a PO I want scores so that I plan", description: "Too short" }));
    expect(failed(short)).toEqual(["C9"]);
    expect(rule(short, "C9").reason).toMatch(/9 characters/);
  });

  it("a bare title lands in Not ready", () => {
    const bare = scoreStory(story({ title: "PDF export", description: "", acceptanceCriteria: "", storyPoints: null }));
    expect(bare.score).toBe(15); // only C5 and C8 pass
    expect(bare.band).toBe("Not ready");
  });
});

describe("band caps (rules v2)", () => {
  it("caps an unestimated story at Needs work without changing its score", () => {
    const result = scoreStory(story({ storyPoints: null }));
    expect(result.score).toBe(80);
    expect(result.band).toBe("Needs work");
    expect(result.bandCap).toMatch(/estimated/);
  });

  it("caps a story above the maximum size", () => {
    const result = scoreStory(story({ storyPoints: 13 }));
    expect(result.score).toBe(90);
    expect(result.band).toBe("Needs work");
    expect(result.bandCap).toMatch(/split/);
  });

  it("leaves lower bands alone", () => {
    const result = scoreStory(story({ storyPoints: null, acceptanceCriteria: "" }));
    expect(result.band).toBe("Not ready");
    expect(result.bandCap).toBeUndefined();
  });

  it("doesn't cap a complete story", () => {
    expect(scoreStory(story()).bandCap).toBeUndefined();
  });
});

describe("bands", () => {
  it.each([
    [100, "Ready"],
    [80, "Ready"],
    [79, "Needs work"],
    [50, "Needs work"],
    [49, "Not ready"],
    [0, "Not ready"],
  ])("%i is %s", (score, band) => {
    expect(bandFor(score)).toBe(band);
  });
});

describe("readySummary", () => {
  it("counts Ready stories", () => {
    const results = [scoreStory(story()), scoreStory(story({ acceptanceCriteria: "" }))];
    expect(readySummary(results)).toBe("1 of 2 stories ready");
  });
});

describe("custom checks", () => {
  const ready = {
    key: "A-1",
    title: "Refund a payment",
    description: "As an agent I want to refund a payment so that the customer is paid back",
    acceptanceCriteria: "- A refund email is sent within 1 minute",
    storyPoints: 3,
    status: "",
  };
  const settings = {
    ...DEFAULT_SETTINGS,
    customChecks: [{ name: "Has a design link", field: "any" as const, phrase: "Figma.com" }],
  };

  it("caps an otherwise Ready story without changing its score", () => {
    const result = scoreStory(ready, settings);
    expect(result.score).toBe(100);
    expect(result.band).toBe("Needs work");
    expect(result.bandCap).toBe("Can't be Ready until it passes your team's checks: Has a design link.");
    expect(result.custom).toEqual([{ name: "Has a design link", passed: false, reason: 'Add "Figma.com" to the story.' }]);
  });

  it("passes, ignoring case, when the phrase is present", () => {
    const result = scoreStory({ ...ready, description: `${ready.description}. Design: https://figma.com/x` }, settings);
    expect(result.band).toBe("Ready");
    expect(result.custom[0].passed).toBe(true);
  });

  it("only looks in the chosen field", () => {
    const criteriaOnly = { ...DEFAULT_SETTINGS, customChecks: [{ name: "Event", field: "criteria" as const, phrase: "event:" }] };
    expect(scoreStory({ ...ready, description: "event: refund" }, criteriaOnly).custom[0].passed).toBe(false);
  });
});
