import { describe, expect, it } from "vitest";
import { carryReasons, daysBetween, planTracking, utcToday, type TrackedSnapshot } from "@/lib/sprint/tracking";
import { story } from "@/test/story";

const day = (text: string) => new Date(`${text}T00:00:00Z`);
const sprint = { endDate: day("2026-10-18") };
const a = story({ key: "A", storyPoints: 5, status: "To Do" });
const b = story({ key: "B", storyPoints: 3, status: "To Do" });
const snap = (over: Partial<TrackedSnapshot>): TrackedSnapshot => ({
  id: "s",
  asOfDate: day("2026-10-05"),
  isBaseline: false,
  auto: false,
  items: [a, b],
  ...over,
});
const baseline = snap({ id: "base", isBaseline: true });

describe("utcToday and daysBetween", () => {
  it("uses the UTC calendar day", () => {
    expect(utcToday(new Date("2026-10-05T23:30:00Z"))).toEqual(day("2026-10-05"));
    expect(daysBetween(day("2026-10-05"), day("2026-10-09"))).toBe(4);
  });
});

describe("planTracking", () => {
  it("records a status change as a new snapshot dated today", () => {
    const plan = planTracking({
      sprint,
      latest: baseline,
      previous: undefined,
      backlog: [{ ...a, status: "Done" }, b],
      today: day("2026-10-07"),
    });
    expect(plan).toMatchObject({ kind: "create", asOfDate: day("2026-10-07") });
    expect(plan.kind === "create" && plan.changes).toEqual([
      { key: "A", type: "status-changed", oldValue: "To Do", newValue: "Done", pointsDelta: 0 },
    ]);
  });

  it("ignores stories that aren't in the sprint, and edits that change nothing", () => {
    const other = story({ key: "C", status: "Done" });
    expect(planTracking({ sprint, latest: baseline, previous: undefined, backlog: [a, b, other], today: day("2026-10-07") })).toEqual({
      kind: "none",
    });
  });

  it("updates today's automatic snapshot instead of adding another", () => {
    const today = snap({ id: "today", auto: true, asOfDate: day("2026-10-07"), items: [{ ...a, status: "Done" }, b] });
    const plan = planTracking({
      sprint,
      latest: today,
      previous: baseline,
      backlog: [{ ...a, status: "Done" }, { ...b, storyPoints: 5 }],
      today: day("2026-10-07"),
    });
    expect(plan.kind).toBe("replace");
    // Compared with the snapshot before today's, so both of today's changes are listed.
    expect(plan.kind === "replace" && plan.changes.map((c) => `${c.key}:${c.type}`)).toEqual(["A:status-changed", "B:re-estimated"]);
  });

  it("drops today's automatic snapshot when an edit is undone", () => {
    const today = snap({ id: "today", auto: true, asOfDate: day("2026-10-07"), items: [{ ...a, status: "Done" }, b] });
    expect(planTracking({ sprint, latest: today, previous: baseline, backlog: [a, b], today: day("2026-10-07") })).toEqual({
      kind: "delete",
      snapshotId: "today",
    });
  });

  it("never rewrites a snapshot someone saved by hand", () => {
    const manual = snap({ id: "manual", auto: false, asOfDate: day("2026-10-07") });
    const plan = planTracking({ sprint, latest: manual, previous: baseline, backlog: [{ ...a, status: "Done" }, b], today: day("2026-10-07") });
    expect(plan.kind).toBe("create");
  });

  it("keeps a story deleted from the backlog as it was", () => {
    const plan = planTracking({ sprint, latest: baseline, previous: undefined, backlog: [b], today: day("2026-10-07") });
    expect(plan).toEqual({ kind: "none" });
  });

  it("allows for time zones at both ends of the sprint", () => {
    const behind = planTracking({
      sprint,
      latest: snap({ asOfDate: day("2026-10-08") }),
      previous: baseline,
      backlog: [{ ...a, status: "Done" }, b],
      today: day("2026-10-07"),
    });
    expect(behind).toMatchObject({ kind: "create", asOfDate: day("2026-10-08") });

    const dayAfter = planTracking({ sprint, latest: baseline, previous: undefined, backlog: [{ ...a, status: "Done" }, b], today: day("2026-10-19") });
    expect(dayAfter).toMatchObject({ kind: "create", asOfDate: day("2026-10-18") });

    const later = planTracking({ sprint, latest: baseline, previous: undefined, backlog: [{ ...a, status: "Done" }, b], today: day("2026-10-20") });
    expect(later).toEqual({ kind: "none" });
  });
});

describe("carryReasons", () => {
  it("keeps tags on changes that are still there", () => {
    const changes = [
      { key: "A", type: "added" as const, oldValue: null, newValue: "5", pointsDelta: 5 },
      { key: "B", type: "re-estimated" as const, oldValue: "3", newValue: "5", pointsDelta: 2 },
    ];
    expect(carryReasons(changes, [{ key: "A", changeType: "added", reason: "bug" }]).map((c) => c.reason)).toEqual(["bug", null]);
  });
});
