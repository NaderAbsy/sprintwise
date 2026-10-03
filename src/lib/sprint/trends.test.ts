import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/readiness/rules";
import { averageVelocity, summarizeTrends, trendRows, type SprintTrendRow } from "@/lib/sprint/trends";
import type { Story } from "@/lib/stories/types";

const story = (key: string, points: number, status = "To Do", ready = false): Story => ({
  key,
  title: ready ? "Refund a payment" : "Make it fast",
  description: ready ? "As an agent I want to refund a payment so that the customer is paid back" : "",
  acceptanceCriteria: ready ? "- A refund email is sent within 1 minute" : "",
  storyPoints: points,
  status,
});

describe("trendRows", () => {
  it("measures each sprint against its own baseline, oldest first", () => {
    const rows = trendRows(
      [
        { id: "b", name: "Sprint 2", startDate: new Date("2026-10-15"), baseline: [story("A", 5, "To Do", true)], latest: [story("A", 5, "Done", true)] },
        { id: "a", name: "Sprint 1", startDate: new Date("2026-10-01"), baseline: [story("A", 4), story("B", 4)], latest: [story("A", 4, "Done")] },
      ],
      DEFAULT_SETTINGS,
    );
    expect(rows.map((r) => r.name)).toEqual(["Sprint 1", "Sprint 2"]);
    expect(rows[0]).toMatchObject({ committed: 8, done: 4, completion: 0.5, readyAtBaseline: 0 });
    expect(rows[1]).toMatchObject({ committed: 5, done: 5, completion: 1, readyAtBaseline: 1 });
  });
});

const row = (done: number, completion: number, churn: number, ready: number): SprintTrendRow => ({
  id: String(Math.random()),
  measured: true,
  name: "S",
  startDate: new Date(),
  committed: 20,
  done,
  completion,
  churn,
  netChange: 0,
  readyAtBaseline: ready,
  averageScore: 70,
});

describe("summarizeTrends", () => {
  it("averages the last three sprints for velocity", () => {
    expect(averageVelocity([row(10, 0.5, 0.2, 0.5), row(20, 1, 0, 1), row(30, 1, 0, 1), row(40, 1, 0, 1)])).toEqual({ points: 30, sprints: 3 });
    expect(averageVelocity([])).toBeNull();
  });

  it("reports improvements against earlier sprints and the readiness link", () => {
    const summary = summarizeTrends([row(10, 0.5, 0.4, 0.2), row(12, 0.6, 0.3, 0.3), row(18, 0.9, 0.1, 0.8), row(19, 0.95, 0.1, 0.9), row(20, 1, 0.05, 1)]);
    expect(summary.insights).toContain("Completion rose 40 points in the last 3 sprints, a good sign.");
    expect(summary.insights).toContain("Churn fell 27 points in the last 3 sprints, a good sign.");
    expect(summary.insights.some((i) => i.startsWith("Sprints that started with more Ready stories finished"))).toBe(true);
  });

  it("ignores sprints that only have a baseline", () => {
    expect(averageVelocity([row(30, 1, 0, 1), { ...row(0, 0, 0, 1), measured: false }])).toEqual({ points: 30, sprints: 1 });
  });

  it("stays quiet with too few sprints", () => {
    expect(summarizeTrends([row(10, 0.5, 0.2, 0.5)]).insights).toEqual([]);
  });
});
