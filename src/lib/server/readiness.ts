import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type Project, type Story as StoryRow } from "@/generated/prisma/client";
import { DEFAULT_VAGUE_WORDS, RULES_VERSION, scoreStory, type RuleSettings } from "@/lib/readiness/rules";
import { readCustomChecks } from "@/lib/readiness/settings";
import type { Story } from "@/lib/stories/types";
import { db } from "@/lib/server/db";

export const projectDefaults = { maxPoints: 8, vagueWords: DEFAULT_VAGUE_WORDS };

export function settingsOf(project: Pick<Project, "maxPoints" | "vagueWords" | "customChecks">): RuleSettings {
  return { maxPoints: project.maxPoints, vagueWords: project.vagueWords, customChecks: readCustomChecks(project.customChecks) };
}

export function toStory(
  row: Pick<StoryRow, "key" | "title" | "description" | "acceptanceCriteria" | "storyPoints" | "status"> & { issueType?: string },
): Story {
  return {
    key: row.key,
    title: row.title,
    description: row.description,
    acceptanceCriteria: row.acceptanceCriteria,
    storyPoints: row.storyPoints,
    status: row.status,
    ...(row.issueType && { issueType: row.issueType }),
  };
}

/** Scores a story and returns the row data for readiness_results. */
export function readinessData(story: Story, settings: RuleSettings) {
  const result = scoreStory(story, settings);
  return {
    score: result.score,
    band: result.band,
    failedRules: [
      ...result.findings.map(({ id, check, reason, points }) => ({ id, check, reason, points })),
      ...result.custom.filter((c) => !c.passed).map(({ name, reason }) => ({ id: "custom", check: name, reason })),
    ] as Prisma.InputJsonValue,
    rulesVersion: result.rulesVersion,
    settingsUsed: settings as unknown as Prisma.InputJsonValue,
  };
}

type Readiness = ReturnType<typeof readinessData>;
type Tx = Prisma.TransactionClient;

/**
 * Stores many scores at once, 500 rows a statement: re-scoring a 1,000-story
 * project is two statements rather than a thousand round trips.
 */
export async function writeScores(client: Tx | typeof db, scores: { storyId: string; readiness: Readiness }[]) {
  const now = new Date();
  for (let i = 0; i < scores.length; i += 500) {
    const rows = scores.slice(i, i + 500).map(
      ({ storyId, readiness: r }) =>
        Prisma.sql`(${randomUUID()}, ${storyId}, ${r.score}, ${r.band}, ${JSON.stringify(r.failedRules)}::jsonb, ${r.rulesVersion}, ${JSON.stringify(r.settingsUsed)}::jsonb, ${now}, ${now})`,
    );
    await client.$executeRaw`
      INSERT INTO readiness_results (id, "storyId", score, band, "failedRules", "rulesVersion", "settingsUsed", "createdAt", "updatedAt")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("storyId") DO UPDATE SET
        score = EXCLUDED.score, band = EXCLUDED.band, "failedRules" = EXCLUDED."failedRules",
        "rulesVersion" = EXCLUDED."rulesVersion", "settingsUsed" = EXCLUDED."settingsUsed", "updatedAt" = EXCLUDED."updatedAt"`;
  }
}

/**
 * Re-scores stories whose stored score came from older rules, so lists and
 * exports agree with the story page after a rules version bump. One cheap query
 * when nothing is stale. Each project is done on its own, with its row locked
 * (as story saves lock it) and its stories read under that lock, so a save at
 * the same moment can't be overwritten by a score of its old text. Callers check
 * ownership first.
 */
export async function refreshStaleScores(projectIds: string[]) {
  if (projectIds.length === 0) return;
  const staleWhere = { OR: [{ readiness: { is: null } }, { readiness: { is: { rulesVersion: { lt: RULES_VERSION } } } }] };
  const stale = await db.story.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds }, ...staleWhere } });
  for (const { projectId } of stale) {
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
        const project = await tx.project.findUnique({ where: { id: projectId } });
        if (!project) return;
        const settings = settingsOf(project);
        const rows = await tx.story.findMany({ where: { projectId, ...staleWhere } });
        await writeScores(tx, rows.map((row) => ({ storyId: row.id, readiness: readinessData(toStory(row), settings) })));
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  }
}
