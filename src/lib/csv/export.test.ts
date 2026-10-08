import { describe, expect, it } from "vitest";
import { backlogCsv, neutralize, storyAsText } from "@/lib/csv/export";
import { parseStoriesCsv } from "@/lib/csv/parse";

const row = {
  key: "PAY-1",
  title: 'Refund, "fast"',
  description: "=HYPERLINK(\"http://evil\")",
  acceptanceCriteria: "- Full refunds\n- Partial refunds",
  storyPoints: 3,
  status: "To Do",
  score: 65,
  band: "Needs work",
  failedChecks: ["States a benefit", "No vague words in the story"],
};

describe("backlogCsv", () => {
  it("quotes, neutralizes formulas and keeps list bullets", () => {
    const csv = backlogCsv([row]);
    expect(csv.startsWith("﻿key,title,description,acceptance_criteria,story_points,status,readiness_score,band,failed_checks\r\n")).toBe(true);
    expect(csv).toContain('"Refund, ""fast"""');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain('"- Full refunds\n- Partial refunds"');
    expect(csv).toContain("States a benefit; No vague words in the story");
  });

  it("re-imports with the same stories", () => {
    const parsed = parseStoriesCsv(backlogCsv([{ ...row, description: "As a user" }]).slice(1));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.stories[0]).toMatchObject({ key: "PAY-1", acceptanceCriteria: "- Full refunds\n- Partial refunds", storyPoints: 3 });
  });

  it("neutralizes a minus that starts a formula", () => {
    expect(backlogCsv([{ ...row, title: "-1+2" }])).toContain("'-1+2");
  });

  it("neutralizes formulas after spaces or a bullet, but not a bullet followed by a word", () => {
    for (const cell of ["- 1+1", "-  2+cmd|' /C calc'!A0", " =1+1", "  @SUM(A1)", "\t=1", "+1"]) expect(neutralize(cell), cell).toBe(`'${cell}`);
    for (const cell of ["- Full refunds", '- "Quoted" text', "Plain text", "", "a - b"]) expect(neutralize(cell), cell).toBe(cell);
  });

  it("re-imports neutralized cells without the apostrophe", () => {
    const parsed = parseStoriesCsv(backlogCsv([{ ...row, title: "- 2 day delivery", description: "=SUM(1)" }]).slice(1));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.stories[0]).toMatchObject({ title: "- 2 day delivery", description: "=SUM(1)" });
  });
});

describe("storyAsText", () => {
  it("lays a story out for pasting", () => {
    expect(storyAsText({ ...row, description: "As a user I want refunds so that I am paid back" })).toBe(
      'PAY-1: Refund, "fast"\n\nAs a user I want refunds so that I am paid back\n\nAcceptance criteria:\n- Full refunds\n- Partial refunds\n\nStory points: 3\nStatus: To Do',
    );
  });
});
