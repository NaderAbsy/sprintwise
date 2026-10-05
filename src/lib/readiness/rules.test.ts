import { describe, expect, it } from "vitest";
import { demoBacklog } from "@/demo/backlog";
import {
  bandFor,
  criteriaNeeded,
  DEFAULT_VAGUE_WORDS,
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
    const criteria = "- The export button appears on every invoice\n- The PDF matches the on-screen invoice\n- The file is named after the invoice number";
    const result = scoreStory(story({ storyPoints: 13, acceptanceCriteria: criteria }));
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

describe("rules v3: harder to fool", () => {
  it("doesn't call a vague story Ready just because it has the right shape", () => {
    const result = scoreStory(
      story({
        title: "As a user I want a dashboard so that I can see stuff",
        description: "",
        acceptanceCriteria: "Given I log in When I open the dashboard Then it works",
        storyPoints: 3,
      }),
    );
    expect(result.score).toBe(55);
    expect(result.band).toBe("Needs work");
    expect(result.findings.map((f) => f.id)).toEqual(["C2", "C3", "C5", "C9"]);
  });

  it.each(["user", "User", "users", "end user", "someone", "anyone"])('"As a %s" doesn\'t name who it\'s for', (role) => {
    const result = scoreStory(story({ description: `As a ${role}, I want to export an invoice so that I can email it` }));
    const c2 = result.rules.find((r) => r.id === "C2")!;
    expect(c2.passed).toBe(false);
    expect(c2.reason).toMatch(/could be anyone/);
  });

  it.each(["finance admin", "logged-in user", "returning customer"])('"As a %s" names who it\'s for', (role) => {
    const result = scoreStory(story({ description: `As a ${role} I want to export an invoice so that I can email it` }));
    expect(result.rules.find((r) => r.id === "C2")!.passed).toBe(true);
  });

  it.each([
    [null, 1],
    [1, 1],
    [3, 1],
    [5, 2],
    [8, 2],
    [13, 3],
  ] as const)("a %s-point story needs %i acceptance criteria", (points, needed) => {
    expect(criteriaNeeded(points)).toBe(needed);
  });

  it("asks a bigger story for more criteria, and says how many", () => {
    const result = scoreStory(story({ storyPoints: 5, acceptanceCriteria: "- The PDF matches the on-screen invoice" }));
    const c1 = result.findings.find((f) => f.id === "C1")!;
    expect(c1.reason).toBe(
      "A 5-point story needs at least 2 acceptance criteria; this has 1. Add one line for each thing the team must build.",
    );
    expect(result.score).toBe(80);
  });

  it("treats words like works, properly and stuff as vague, but not working days", () => {
    expect(findVagueWords("Then it works properly", DEFAULT_VAGUE_WORDS)).toEqual(["works", "properly"]);
    expect(findVagueWords("The refund arrives within 3 working days", DEFAULT_VAGUE_WORDS)).toEqual([]);
  });
});

describe("findings: one reason per missing thing", () => {
  it("folds untestable criteria into missing criteria", () => {
    const result = scoreStory(story({ acceptanceCriteria: "" }));
    expect(result.findings).toEqual([
      expect.objectContaining({ id: "C1", points: 35, reason: expect.stringMatching(/so nothing can be tested/) }),
    ]);
    expect(result.rules.find((r) => r.id === "C3")).toMatchObject({ passed: false, coveredBy: "C1" });
  });

  it("folds size into estimate", () => {
    const result = scoreStory(story({ storyPoints: null }));
    expect(result.findings).toEqual([expect.objectContaining({ id: "C6", points: 20 })]);
  });

  it('folds a missing benefit into the story format when there\'s no "so that"', () => {
    const result = scoreStory(story({ description: "As a finance admin I want to export an invoice as a PDF" }));
    expect(result.findings).toEqual([expect.objectContaining({ id: "C2", points: 25, reason: expect.stringMatching(/no benefit/) })]);
  });

  it('keeps an empty "so that" as its own finding', () => {
    const result = scoreStory(story({ description: "As a finance admin I want to export an invoice as a PDF so that" }));
    expect(result.findings.map((f) => [f.id, f.points])).toEqual([["C4", 10]]);
  });

  it("always adds up to the points lost", () => {
    for (const s of demoBacklog) {
      const result = scoreStory(s);
      expect(result.findings.reduce((sum, f) => sum + f.points, 0)).toBe(100 - result.score);
    }
  });

  it("turns seven failed checks on a bare story into four things to fix", () => {
    const result = scoreStory(story({ title: "Admin dashboard", description: "", acceptanceCriteria: "", storyPoints: null }));
    expect(result.rules.filter((r) => !r.passed)).toHaveLength(7);
    expect(result.findings.map((f) => f.id)).toEqual(["C1", "C2", "C6", "C9"]);
    expect(result.score).toBe(15);
  });
});
