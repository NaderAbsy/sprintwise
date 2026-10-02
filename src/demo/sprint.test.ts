import { describe, expect, it } from "vitest";
import { demoSprint } from "@/demo/sprint";
import { DEFAULT_SETTINGS } from "@/lib/readiness/rules";
import { computeMetrics, formatPercent } from "@/lib/sprint/metrics";
import { changeLog, compareReadiness, readinessFinding } from "@/lib/sprint/report";

// The demo is what recruiters see first, so its story is pinned down here.
describe("demo sprint", () => {
  const baseline = demoSprint.snapshots[0].stories;
  const latest = demoSprint.snapshots.at(-1)!.stories;

  it("has the intended metrics", () => {
    const m = computeMetrics(baseline, latest);
    expect([m.baselineTotal, m.latestTotal, m.scopeAdded, m.scopeRemoved]).toEqual([32, 38, 3, 5]);
    expect(formatPercent(m.netChange, { signed: true })).toBe("+18.8%");
    expect(formatPercent(m.churn)).toBe("50.0%");
    expect(formatPercent(m.completion)).toBe("37.5%");
  });

  it("shows that the stories that changed scored lower at the baseline", () => {
    const r = compareReadiness(baseline, latest, DEFAULT_SETTINGS);
    expect(r.changedKeys.sort()).toEqual(["TIDY-103", "TIDY-104", "TIDY-110"]);
    expect(r.changed.averageScore).toBe(55);
    expect(r.unchanged.averageScore).toBe(95);
    expect(readinessFinding(r)).toBe("Stories that changed scored 40 points lower at the baseline than those that didn't.");
  });

  it("logs changes on two later dates", () => {
    expect(new Set(changeLog(demoSprint.snapshots).map((r) => r.date))).toEqual(new Set(["13 Oct 2026", "8 Oct 2026"]));
  });
});
