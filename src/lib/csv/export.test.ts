import { describe, expect, it } from "vitest";
import { backlogCsv, storyAsText } from "@/lib/csv/export";
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
});

describe("storyAsText", () => {
  it("lays a story out for pasting", () => {
    expect(storyAsText({ ...row, description: "As a user I want refunds so that I am paid back" })).toBe(
      'PAY-1: Refund, "fast"\n\nAs a user I want refunds so that I am paid back\n\nAcceptance criteria:\n- Full refunds\n- Partial refunds\n\nStory points: 3\nStatus: To Do',
    );
  });
});
