import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/readiness/rules";
import { changeLog, compareReadiness, isScopeChange, readinessFinding } from "@/lib/sprint/report";
import { story } from "@/test/story";

// A complete story scores 100; one with no criteria scores 65 (C1 and C3 fail).
const ready = (key: string, overrides = {}) => story({ key, ...overrides });
const vague = (key: string, overrides = {}) => story({ key, acceptanceCriteria: "", ...overrides });

describe("compareReadiness", () => {
  it("splits baseline stories by whether their scope changed, scored as at the baseline", () => {
    const baseline = [ready("A"), ready("B"), vague("C"), vague("D")];
    const latest = [
      ready("A", { status: "Done", title: "Renamed" }), // status and rename only: unchanged
      ready("B"),
      vague("C", { storyPoints: 8 }), // re-estimated: changed
      // D removed: changed
      ready("E"), // added: in neither group
    ];
    const result = compareReadiness(baseline, latest, DEFAULT_SETTINGS);
    expect(result.changedKeys.sort()).toEqual(["C", "D"]);
    expect(result.changed).toEqual({ count: 2, averageScore: 65 });
    expect(result.unchanged).toEqual({ count: 2, averageScore: 100 });
  });

  it("counts a criteria change as a scope change", () => {
    const result = compareReadiness([ready("A")], [ready("A", { acceptanceCriteria: "- Something else" })], DEFAULT_SETTINGS);
    expect(result.changed.count).toBe(1);
  });

  it("handles a sprint with no changes", () => {
    const result = compareReadiness([ready("A")], [ready("A")], DEFAULT_SETTINGS);
    expect(result.changed).toEqual({ count: 0, averageScore: null });
    expect(readinessFinding(result)).toBe("No committed story changed scope during the sprint.");
  });
});

describe("readinessFinding", () => {
  const groups = (changed: number | null, unchanged: number | null) => ({
    changed: { count: changed === null ? 0 : 2, averageScore: changed },
    unchanged: { count: unchanged === null ? 0 : 2, averageScore: unchanged },
    changedKeys: [],
  });

  it("states the gap in points", () => {
    expect(readinessFinding(groups(65, 100))).toBe(
      "Stories that changed scored 35 points lower at the baseline than those that didn't.",
    );
    expect(readinessFinding(groups(90, 70))).toBe(
      "Stories that changed scored 20 points higher at the baseline than those that didn't.",
    );
  });

  it("calls small gaps about the same", () => {
    expect(readinessFinding(groups(78, 80))).toMatch(/about the same/);
  });

  it("covers a sprint where everything changed", () => {
    expect(readinessFinding(groups(70, null))).toBe("Every committed story changed scope during the sprint.");
  });
});

describe("isScopeChange", () => {
  it("excludes status changes and renames", () => {
    expect(isScopeChange({ type: "status-changed" })).toBe(false);
    expect(isScopeChange({ type: "renamed" })).toBe(false);
    expect(isScopeChange({ type: "re-estimated" })).toBe(true);
  });
});

describe("changeLog", () => {
  const day = (d: string) => new Date(`${d}T00:00:00Z`);

  it("compares each snapshot with the previous one, newest first", () => {
    const log = changeLog([
      { asOfDate: day("2026-10-05"), stories: [ready("A"), ready("B")] },
      { asOfDate: day("2026-10-08"), stories: [ready("A")] },
      { asOfDate: day("2026-10-13"), stories: [ready("A", { storyPoints: 5 }), ready("C")] },
    ]);
    expect(log.map((r) => `${r.date} ${r.key} ${r.type}`)).toEqual([
      "13 Oct 2026 A re-estimated",
      "13 Oct 2026 C added",
      "8 Oct 2026 B removed",
    ]);
  });

  it("is empty for a baseline alone", () => {
    expect(changeLog([{ asOfDate: day("2026-10-05"), stories: [ready("A")] }])).toEqual([]);
  });
});
