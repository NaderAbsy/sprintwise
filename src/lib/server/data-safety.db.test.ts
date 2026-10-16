import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Project } from "@/generated/prisma/client";
import type { ImportStory } from "@/lib/csv/import";
import { RULES_VERSION } from "@/lib/readiness/rules";
import { overLimit } from "@/lib/server/action-limits";
import { db } from "@/lib/server/db";
import { readinessData, refreshStaleScores, settingsOf, writeScores } from "@/lib/server/readiness";
import { saveStories } from "@/lib/server/save-stories";

/**
 * Against a real Postgres (the local Docker one, or CI's): the locking and merging
 * code that unit tests can't reach. Run with `pnpm test:db` after migrations.
 */

const tag = `db-test-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
let project: Project;

const story = (key: string, extra: Partial<ImportStory> = {}): ImportStory => ({
  key,
  title: `Story ${key}`,
  description: "As an agent I want to refund a payment so that the customer is paid back.",
  acceptanceCriteria: "- Full refunds\n- Partial refunds",
  storyPoints: 3,
  status: "To Do",
  issueType: "",
  epic: "",
  ...extra,
});
const row = (key: string) => db.story.findUniqueOrThrow({ where: { projectId_key: { projectId: project.id, key } }, include: { readiness: true } });

beforeAll(async () => {
  await db.user.create({ data: { id: tag, name: "DB test", email: `${tag}@example.test` } });
  project = await db.project.create({ data: { userId: tag, name: "DB test", vagueWords: [] } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: tag } });
  await db.actionLimit.deleteMany({ where: { key: { endsWith: `:${tag}` } } });
  await db.$disconnect();
});

describe("saveStories", () => {
  it("keeps the fields a file has no column for", async () => {
    await saveStories(project, [story("PAY-1")]);
    await saveStories(project, [story("PAY-1", { title: "Refund a card payment", description: "", acceptanceCriteria: "", storyPoints: null, status: "In Progress" })], {
      fields: new Set(["title", "status"]),
    });
    const saved = await row("PAY-1");
    expect(saved).toMatchObject({ title: "Refund a card payment", status: "In Progress", storyPoints: 3, acceptanceCriteria: "- Full refunds\n- Partial refunds" });
    expect(saved.description).toContain("paid back");
  });

  it("on Sync, merges a story edited here field by field and keeps it edited", async () => {
    await saveStories(project, [story("PAY-2")], { fromJira: true });
    await db.story.update({ where: { id: (await row("PAY-2")).id }, data: { storyPoints: 5, editedAt: new Date() } });
    const result = await saveStories(project, [story("PAY-2", { description: "Rewritten in Jira.", status: "Done" })], { merge: true, fromJira: true });
    const saved = await row("PAY-2");
    expect(saved).toMatchObject({ storyPoints: 5, description: "Rewritten in Jira.", status: "Done" });
    expect(saved.editedAt).not.toBeNull();
    expect(result.stillEdited).toBe(1);
    // Scored with the merged values.
    expect(saved.readiness?.rulesVersion).toBe(RULES_VERSION);
  });

  it("can't pass the story limit when two imports arrive together", async () => {
    const count = await db.story.count({ where: { projectId: project.id } });
    const results = await Promise.allSettled([
      saveStories(project, [story("RACE-1")], { maxStories: count + 1 }),
      saveStories(project, [story("RACE-2")], { maxStories: count + 1 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.story.count({ where: { projectId: project.id } })).toBe(count + 1);
  });
});

describe("scores", () => {
  it("writeScores adds and replaces scores in bulk", async () => {
    const saved = await row("PAY-1");
    const readiness = readinessData(story("PAY-1"), settingsOf(project));
    await writeScores(db, [{ storyId: saved.id, readiness: { ...readiness, score: 12 } }]);
    expect((await row("PAY-1")).readiness?.score).toBe(12);
    await writeScores(db, [{ storyId: saved.id, readiness }]);
    expect((await row("PAY-1")).readiness?.score).toBe(readiness.score);
    expect(await db.readinessResult.count({ where: { storyId: saved.id } })).toBe(1);
  });

  it("refreshStaleScores re-scores stories scored by older rules", async () => {
    const saved = await row("PAY-1");
    await db.readinessResult.update({ where: { storyId: saved.id }, data: { rulesVersion: 1, score: 0 } });
    await refreshStaleScores([project.id]);
    expect((await row("PAY-1")).readiness).toMatchObject({ rulesVersion: RULES_VERSION });
    expect((await row("PAY-1")).readiness?.score).toBeGreaterThan(0);
  });
});

describe("action limits", () => {
  it("count every request sent at the same moment", async () => {
    const answers = await Promise.all(Array.from({ length: 45 }, () => overLimit("snapshot", tag)));
    expect(answers.filter((a) => a !== null)).toHaveLength(5);
  });
});
