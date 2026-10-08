import { describe, expect, it } from "vitest";
import { defaultReasons, isBugType, reasonFinding, summarizeReasons } from "@/lib/sprint/reasons";

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

describe("defaultReasons", () => {
  const items = [
    { key: "BUG-1", issueType: "Bug" },
    { key: "INC-2", issueType: " incident " },
    { key: "ST-3", issueType: "Story" },
    { key: "NO-4" },
  ];

  it("tags added bugs as Bug or incident, and nothing else", () => {
    const changes = [
      { key: "BUG-1", type: "added" },
      { key: "inc-2", type: "added" },
      { key: "ST-3", type: "added" },
      { key: "NO-4", type: "added" },
      { key: "BUG-1", type: "re-estimated" },
    ];
    expect(defaultReasons(changes, items).map((c) => c.reason)).toEqual(["bug", "bug", null, null, null]);
  });

  it("never replaces a reason someone chose", () => {
    expect(defaultReasons([{ key: "BUG-1", type: "added", reason: "stakeholder" }], items)[0].reason).toBe("stakeholder");
  });

  it("knows the usual bug types", () => {
    for (const t of ["Bug", "defect", "Incident", "Hotfix"]) expect(isBugType(t), t).toBe(true);
    for (const t of ["Story", "Task", "", undefined]) expect(isBugType(t), String(t)).toBe(false);
  });
});
