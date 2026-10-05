import { describe, expect, it } from "vitest";
import { diffSnapshots } from "@/lib/sprint/diff";
import { computeMetrics, formatPercent, formatPoints, isDone } from "@/lib/sprint/metrics";
import { story } from "@/test/story";
import { baseline, latest } from "@/test/worked-example";

describe("worked example from the requirements doc", () => {
  const m = computeMetrics(baseline, latest);

  it("produces exactly the documented numbers", () => {
    expect(m.baselineTotal).toBe(30);
    expect(m.latestTotal).toBe(35);
    expect(m.scopeAdded).toBe(5);
    expect(m.scopeRemoved).toBe(3);
    expect(m.reestimateTotal).toBe(3);
    expect(m.netChange).toBeCloseTo(5 / 30, 10);
    expect(m.churn).toBeCloseTo(11 / 30, 10);
    expect(m.completion).toBeCloseTo(21 / 30, 10);
  });

  it("formats as +16.7%, 36.7% and 70.0%", () => {
    expect(formatPercent(m.netChange, { signed: true })).toBe("+16.7%");
    expect(formatPercent(m.churn)).toBe("36.7%");
    expect(formatPercent(m.completion)).toBe("70.0%");
    expect(formatPercent(-0.8333, { signed: true })).toBe("−83.3%");
  });

  it("lists the changes behind them", () => {
    const changes = diffSnapshots(baseline, latest).filter((c) => c.type !== "status-changed");
    expect(changes).toEqual([
      { key: "A", type: "re-estimated", oldValue: "5", newValue: "8", pointsDelta: 3 },
      { key: "B", type: "removed", oldValue: "3", newValue: null, pointsDelta: -3 },
      { key: "F", type: "added", oldValue: null, newValue: "5", pointsDelta: 5 },
    ]);
  });
});

describe("diffSnapshots", () => {
  it("matches by key, so a rename is one change, not a removal and an addition", () => {
    const changes = diffSnapshots([story({ key: "X-1" })], [story({ key: " x-1 ", title: "New name" })]);
    expect(changes).toEqual([
      { key: "X-1", type: "renamed", oldValue: "Export invoices as PDF", newValue: "New name", pointsDelta: 0 },
    ]);
  });

  it("detects criteria and status changes, ignoring bullet style and status case", () => {
    const before = story({ acceptanceCriteria: "- One\n- Two", status: "to do" });
    expect(diffSnapshots([before], [story({ acceptanceCriteria: "1. One\n2. Two", status: "To Do" })])).toEqual([]);
    const changes = diffSnapshots([before], [story({ acceptanceCriteria: "- One\n- Three", status: "Done" })]);
    expect(changes.map((c) => c.type)).toEqual(["criteria-changed", "status-changed"]);
  });

  it("treats a blank estimate as 0 points", () => {
    const changes = diffSnapshots([story({ storyPoints: null })], [story({ storyPoints: 5 })]);
    expect(changes).toEqual([{ key: "TEST-1", type: "re-estimated", oldValue: null, newValue: "5", pointsDelta: 5 }]);
  });

  it("finds nothing between identical snapshots", () => {
    expect(diffSnapshots(baseline, baseline)).toEqual([]);
  });
});

describe("computeMetrics edge cases", () => {
  it("returns null percentages for a zero baseline", () => {
    const m = computeMetrics([story({ storyPoints: null })], [story({ storyPoints: 3 })]);
    expect(m.netChange).toBeNull();
    expect(m.churn).toBeNull();
    expect(m.completion).toBeNull();
    expect(formatPercent(m.churn)).toBe("—");
  });

  it("flags unestimated stories and counts them as 0", () => {
    const m = computeMetrics(
      [story({ key: "A", storyPoints: 5 }), story({ key: "B", storyPoints: null })],
      [story({ key: "A", storyPoints: 5 }), story({ key: "C", storyPoints: null })],
    );
    expect(m.unestimatedKeys).toEqual(["B", "C"]);
    expect(m.scopeAdded).toBe(0);
    expect(m.scopeRemoved).toBe(0);
  });

  it("counts re-estimates in both directions toward churn", () => {
    const m = computeMetrics(
      [story({ key: "A", storyPoints: 5 }), story({ key: "B", storyPoints: 5 })],
      [story({ key: "A", storyPoints: 8 }), story({ key: "B", storyPoints: 2 })],
    );
    expect(m.netChange).toBe(0);
    expect(m.churn).toBeCloseTo(0.6, 10);
  });

  it("counts completion at baseline points, excluding added stories", () => {
    const m = computeMetrics(
      [story({ key: "A", storyPoints: 5 })],
      [story({ key: "A", storyPoints: 13, status: "Closed" }), story({ key: "B", storyPoints: 5, status: "Done" })],
    );
    expect(m.completion).toBe(1);
  });
});

describe("isDone", () => {
  it.each(["Done", " closed ", "RESOLVED"])("%s is done", (s) => expect(isDone(s)).toBe(true));
  it.each(["In progress", "To Do", ""])("%s is not done", (s) => expect(isDone(s)).toBe(false));
});

describe("a project's own done statuses", () => {
  const released = ["Released", "Accepted"];

  it("match ignoring case and spaces", () => {
    expect(isDone(" released ", released)).toBe(true);
    expect(isDone("ACCEPTED", released)).toBe(true);
  });

  it("replace the defaults rather than adding to them", () => {
    expect(isDone("Done", released)).toBe(false);
  });

  it("never count an empty status as done", () => {
    expect(isDone("", ["Done", ""])).toBe(false);
  });

  it("change completion and velocity", () => {
    const before = [story({ key: "A", storyPoints: 5 }), story({ key: "B", storyPoints: 3 })];
    const after = [story({ key: "A", storyPoints: 5, status: "Released" }), story({ key: "B", storyPoints: 3, status: "Done" })];
    expect(computeMetrics(before, after).donePoints).toBe(3);
    expect(computeMetrics(before, after, released).donePoints).toBe(5);
    expect(computeMetrics(before, after, released).completion).toBeCloseTo(5 / 8, 10);
  });
});

describe("formatPoints", () => {
  it.each([
    [0, "0 pts"],
    [1, "1 pt"],
    [1.5, "1.5 pts"],
    ["1", "1 pt"],
    [13, "13 pts"],
  ] as const)("%s → %s", (value, text) => expect(formatPoints(value)).toBe(text));
});
