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
  it("counts the project's own done statuses", () => {
    const sprint = { id: "a", name: "Sprint 1", startDate: new Date("2026-10-01"), baseline: [story("A", 5)], latest: [story("A", 5, "Released")] };
    expect(trendRows([sprint], DEFAULT_SETTINGS)[0].done).toBe(0);
    expect(trendRows([sprint], DEFAULT_SETTINGS, ["Released"])[0].done).toBe(5);
  });
});

const row = (done: number, completion: number, churn: number, ready: number): SprintTrendRow => ({
  id: String(Math.random()),
  measured: true,
  running: false,
  added: 0,
  addedBugs: 0,
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
    expect(averageVelocity([row(10, 0.5, 0.2, 0.5), row(20, 1, 0, 1), row(30, 1, 0, 1), row(40, 1, 0, 1)])).toMatchObject({ points: 30, sprints: 3 });
    expect(averageVelocity([])).toBeNull();
  });

  it("reports improvements against earlier sprints and the readiness link", () => {
    const summary = summarizeTrends([row(10, 0.5, 0.4, 0.2), row(12, 0.6, 0.3, 0.3), row(18, 0.9, 0.1, 0.8), row(19, 0.95, 0.1, 0.9), row(20, 1, 0.05, 1)]);
    expect(summary.insights).toContain("Completion averaged 40 points higher over the last 3 sprints than before, a good sign.");
    expect(summary.insights).toContain("Churn averaged 27 points lower over the last 3 sprints than before, a good sign.");
    expect(summary.insights.some((i) => i.startsWith("Sprints that started with more Ready stories finished"))).toBe(true);
  });

  it("ignores sprints that only have a baseline", () => {
    expect(averageVelocity([row(30, 1, 0, 1), { ...row(0, 0, 0, 1), measured: false }])).toMatchObject({ points: 30, sprints: 1 });
  });

  it("stays quiet with one sprint", () => {
    expect(summarizeTrends([row(10, 0.5, 0.2, 0.5)])).toMatchObject({ insights: [], basis: null });
  });

  it("compares the latest sprint with the one before from the second sprint", () => {
    const first = { ...row(10, 0.6, 0.3, 0.5), name: "Sprint 1" };
    const second = { ...row(15, 0.75, 0.32, 0.4), name: "Sprint 2" };
    expect(summarizeTrends([first, second])).toMatchObject({
      basis: "previous",
      insights: [
        "Completion rose from 60% to 75% since Sprint 1, a good sign.",
        "Stories Ready at planning fell from 50% to 40% since Sprint 1.",
      ],
    });
  });

  it("switches to averages from the fourth sprint", () => {
    const summary = summarizeTrends([row(10, 0.5, 0.4, 0.2), row(12, 0.6, 0.3, 0.3), row(18, 0.9, 0.1, 0.8), row(20, 1, 0.05, 1)]);
    expect(summary.basis).toBe("trend");
    expect(summary.insights.some((i) => i.includes("since"))).toBe(false);
  });
});

describe("running sprints", () => {
  it("leaves a sprint still running out of the averages", () => {
    const [done, running] = trendRows(
      [
        { id: "a", name: "Sprint 1", startDate: new Date("2026-09-01"), baseline: [], latest: [], running: false },
        { id: "b", name: "Sprint 2", startDate: new Date("2026-09-15"), baseline: [], latest: [], running: true },
      ],
      DEFAULT_SETTINGS,
    );
    expect(done).toMatchObject({ measured: true, running: false });
    expect(running).toMatchObject({ measured: false, running: true });
  });
});

describe("unplanned work", () => {
  const story = (key: string, storyPoints: number | null, issueType = ""): Story => ({
    key, title: key, description: "", acceptanceCriteria: "", storyPoints, status: "", issueType,
  });

  it("measures what was added mid-sprint, and how much of it was bugs", () => {
    const [row] = trendRows(
      [{ id: "a", name: "Sprint 1", startDate: new Date("2026-09-01"), baseline: [story("A-1", 5)], latest: [story("A-1", 5), story("A-2", 3, "Bug"), story("A-3", 2, "Story"), story("A-4", null, "Bug")] }],
      DEFAULT_SETTINGS,
    );
    expect(row).toMatchObject({ added: 5, addedBugs: 3 });
  });

  it("says how much unplanned work the velocity already allows for", () => {
    const rows = [row(20, 1, 0, 1), row(22, 1, 0, 1)].map((r, i) => ({ ...r, added: [4, 6][i], addedBugs: [2, 3][i] }));
    expect(averageVelocity(rows)).toEqual({ points: 21, sprints: 2, unplanned: 5, unplannedBugs: 2.5 });
  });
});
