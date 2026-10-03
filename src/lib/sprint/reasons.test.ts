import { describe, expect, it } from "vitest";
import { reasonFinding, summarizeReasons } from "@/lib/sprint/reasons";

describe("summarizeReasons", () => {
  it("sums points moved per reason, largest first, and counts untagged changes", () => {
    const summary = summarizeReasons([
      { type: "added", pointsDelta: 5, reason: "stakeholder" },
      { type: "removed", pointsDelta: -3, reason: "stakeholder" },
      { type: "added", pointsDelta: 2, reason: "bug" },
      { type: "re-estimated", pointsDelta: 2, reason: null },
      { type: "criteria-changed", pointsDelta: 0, reason: "nonsense" },
    ]);
    expect(summary.totalPoints).toBe(12);
    expect(summary.untagged).toBe(2);
    expect(summary.rows[0]).toMatchObject({ id: "stakeholder", points: 8, count: 2 });
    expect(summary.rows[0].share).toBeCloseTo(8 / 12);
    expect(reasonFinding(summary)).toBe("67% of the scope that moved came from stakeholder requests.");
  });

  it("has no finding when nothing is tagged", () => {
    expect(reasonFinding(summarizeReasons([{ type: "added", pointsDelta: 3 }]))).toBeNull();
  });
});
