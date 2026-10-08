import { describe, expect, it } from "vitest";
import { burnupSeries, burnupSummary } from "@/lib/sprint/burnup";
import { story } from "@/test/story";

const day = (text: string) => new Date(`${text}T00:00:00Z`);
const a = story({ key: "A", storyPoints: 5 });
const b = story({ key: "B", storyPoints: 3 });

describe("burnupSeries", () => {
  const series = burnupSeries([
    { asOfDate: day("2026-10-05"), items: [a, b] },
    { asOfDate: day("2026-10-07"), items: [{ ...a, status: "Done" }, b] },
    // Two snapshots on one day: the later one counts.
    { asOfDate: day("2026-10-09"), items: [{ ...a, status: "Done" }, b] },
    { asOfDate: day("2026-10-09"), items: [{ ...a, status: "Done" }, b, story({ key: "C", storyPoints: 2, status: "Closed" })] },
  ]);

  it("gives scope and done per day", () => {
    expect(series).toEqual([
      { date: day("2026-10-05"), scope: 8, done: 0 },
      { date: day("2026-10-07"), scope: 8, done: 5 },
      { date: day("2026-10-09"), scope: 10, done: 7 },
    ]);
  });

  it("uses the project's own done statuses", () => {
    expect(burnupSeries([{ asOfDate: day("2026-10-05"), items: [{ ...a, status: "Released" }] }], ["Released"])[0].done).toBe(5);
  });

  it("sums it up in a sentence", () => {
    expect(burnupSummary(series)).toBe("Scope went from 8 to 10 points, and 7 of those 10 are done.");
    expect(burnupSummary(series.slice(0, 1))).toBe("Scope stayed at 8 points, and 0 of them are done.");
    // A change on the baseline's own day: the chart has one point, but scope did change.
    expect(burnupSummary([{ date: day("2026-10-08"), scope: 21, done: 2 }], 26)).toBe("Scope went from 26 to 21 points, and 2 of those 21 are done.");
    expect(burnupSummary([])).toBe("No snapshots yet.");
  });
});
