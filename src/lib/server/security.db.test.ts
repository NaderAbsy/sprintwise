import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Project } from "@/generated/prisma/client";
import { ACTION_LIMITS, overLimit } from "@/lib/server/action-limits";
import { db } from "@/lib/server/db";
import { leaveOutOfSync } from "@/lib/server/jira-sync";
import { recordSecurityEvent, securityCounts } from "@/lib/server/security-events";
import { storyRoom } from "@/lib/server/within-limit";
import { MAX_STORIES_PER_ACCOUNT } from "@/lib/limits";

/**
 * Against a real Postgres: the security additions of 2026-10-30 that need SQL (refusal counts, the edit limit, the
 * account story cap, the left-out list). Run with `pnpm test:db` after migrations.
 */

const tag = `sec-test-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
let project: Project;

beforeAll(async () => {
  await db.user.create({ data: { id: tag, name: "Security test", email: `${tag}@example.test` } });
  project = await db.project.create({ data: { userId: tag, name: "Security test", vagueWords: [], jiraCloudId: "cloud-1", jiraLeftOut: [] } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: tag } });
  await db.actionLimit.deleteMany({ where: { key: { endsWith: `:${tag}` } } });
  await db.securityCount.deleteMany({ where: { day: { in: ["2026-01-05", "2026-01-06"] } } });
  await db.$disconnect();
});

describe("refusal counts", () => {
  it("add up per day and kind", async () => {
    const t0 = new Date("2026-01-05T10:00:00Z");
    await Promise.all([1, 2, 3].map(() => recordSecurityEvent("auth_refused", t0))); // sent together: none lost
    await recordSecurityEvent("cron_denied", new Date(t0.getTime() + 5_000));
    const rows = await db.securityCount.findMany({ where: { day: "2026-01-05" }, orderBy: { kind: "asc" } });
    expect(rows).toEqual([
      { day: "2026-01-05", kind: "auth_refused", count: 3 },
      { day: "2026-01-05", kind: "cron_denied", count: 1 },
    ]);

    // A new day starts a new row.
    await recordSecurityEvent("auth_refused", new Date("2026-01-06T00:00:30Z"));
    expect(await db.securityCount.findUnique({ where: { day_kind: { day: "2026-01-06", kind: "auth_refused" } } })).toMatchObject({ count: 1 });
  });

  it("are totalled for the Insights page: last 30 days, plus today", async () => {
    const totals = await securityCounts(30, new Date("2026-01-06T12:00:00Z"));
    expect(totals.totals.auth_refused).toBeGreaterThanOrEqual(4);
    expect(totals.today.auth_refused).toBe(1);
    // Outside the window: not counted.
    expect((await securityCounts(1, new Date("2026-01-06T12:00:00Z"))).totals.cron_denied).toBe(0);
  });
});

describe("the edit limit", () => {
  it("allows a busy person, then refuses with a message and counts it", async () => {
    const { max } = ACTION_LIMITS.edit;
    const now = new Date();
    for (let i = 0; i < max; i++) expect(await overLimit("edit", tag, now)).toBeNull();
    expect(await overLimit("edit", tag, now)).toMatch(/a lot of edits/);
    // A new window starts afresh.
    expect(await overLimit("edit", tag, new Date(now.getTime() + 11 * 60_000))).toBeNull();
  });
});

describe("the account story cap", () => {
  it("lets an account add up to the cap and refuses past it", async () => {
    await db.story.create({ data: { projectId: project.id, key: "CAP-1", title: "One", rank: 1, description: "", acceptanceCriteria: "", status: "To Do" } });
    expect(await storyRoom(db, tag, MAX_STORIES_PER_ACCOUNT - 1)).toBeNull();
    expect(await storyRoom(db, tag, MAX_STORIES_PER_ACCOUNT)).toMatch(/most one account can keep/);
  });
});

describe("the left-out list", () => {
  it("keeps each deleted key once, newest last, and never more than the cap", async () => {
    await leaveOutOfSync(project.id, ["A-1", "A-2", "A-3"]);
    await leaveOutOfSync(project.id, ["A-2", "A-4"]); // A-2 again: moves to the end, not duplicated
    expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).jiraLeftOut).toEqual(["A-1", "A-3", "A-2", "A-4"]);

    // Deleting and re-importing the same 1,000 stories over and over can't grow it.
    const thousand = Array.from({ length: 1000 }, (_, i) => `B-${i}`);
    for (let i = 0; i < 3; i++) await leaveOutOfSync(project.id, thousand);
    const list = (await db.project.findUniqueOrThrow({ where: { id: project.id } })).jiraLeftOut as string[];
    expect(list.filter((k) => k.startsWith("B-"))).toHaveLength(1000);
    expect(list).toHaveLength(1004);

    // Far more distinct keys than the cap: the newest 5,000 stay.
    const many = Array.from({ length: 6000 }, (_, i) => `C-${i}`);
    await leaveOutOfSync(project.id, many);
    const capped = (await db.project.findUniqueOrThrow({ where: { id: project.id } })).jiraLeftOut as string[];
    expect(capped).toHaveLength(5000);
    expect(capped.at(-1)).toBe("C-5999");
    expect(capped[0]).toBe("C-1000");
  });
});
