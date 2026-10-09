import { describe, expect, it } from "vitest";
import { funnel, weeklyCounts } from "@/lib/insights";

describe("funnel", () => {
  it("gives each step's share of the step before", () => {
    const steps = funnel([
      { label: "Signed up", hint: "", count: 40 },
      { label: "Created a project", hint: "", count: 30 },
      { label: "Added stories", hint: "", count: 0 },
      { label: "Locked a baseline", hint: "", count: 0 },
    ]);
    expect(steps.map((s) => s.ofPrevious)).toEqual([null, 0.75, 0, null]);
  });
});

describe("weeklyCounts", () => {
  it("buckets dates into Monday-start weeks, oldest first", () => {
    const now = new Date("2026-10-10T12:00:00Z"); // a Saturday; its week starts Monday 5 October
    const counts = weeklyCounts(
      [new Date("2026-10-05T00:00:00Z"), new Date("2026-10-09T23:00:00Z"), new Date("2026-10-04T23:59:00Z"), new Date("2026-08-01T00:00:00Z")],
      now,
      2,
    );
    expect(counts).toEqual([
      { weekOf: new Date("2026-09-28T00:00:00Z"), count: 1 },
      { weekOf: new Date("2026-10-05T00:00:00Z"), count: 2 },
    ]);
  });
});
