import "server-only";
import type { Prisma, Project, Story as StoryRow } from "@/generated/prisma/client";
import { DEFAULT_VAGUE_WORDS, RULES_VERSION, scoreStory, type RuleSettings } from "@/lib/readiness/rules";
import { readCustomChecks } from "@/lib/readiness/settings";
import type { Story } from "@/lib/stories/types";
import { db } from "@/lib/server/db";

export const projectDefaults = { maxPoints: 8, vagueWords: DEFAULT_VAGUE_WORDS };

export function settingsOf(project: Pick<Project, "maxPoints" | "vagueWords" | "customChecks">): RuleSettings {
  return { maxPoints: project.maxPoints, vagueWords: project.vagueWords, customChecks: readCustomChecks(project.customChecks) };
}

export function toStory(row: Pick<StoryRow, "key" | "title" | "description" | "acceptanceCriteria" | "storyPoints" | "status">): Story {
  return {
    key: row.key,
    title: row.title,
    description: row.description,
    acceptanceCriteria: row.acceptanceCriteria,
    storyPoints: row.storyPoints,
    status: row.status,
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

/**
 * Re-scores stories whose stored score came from older rules, so lists and
 * exports agree with the story page after a rules version bump. One cheap query
 * when nothing is stale. Callers check ownership first.
 */
export async function refreshStaleScores(projectIds: string[]) {
  if (projectIds.length === 0) return;
  const stale = await db.story.findMany({
    where: {
      projectId: { in: projectIds },
      OR: [{ readiness: { is: null } }, { readiness: { is: { rulesVersion: { lt: RULES_VERSION } } } }],
    },
    include: { project: true },
  });
  if (stale.length === 0) return;
  await db.$transaction(
    stale.map((row) => {
      const readiness = readinessData(toStory(row), settingsOf(row.project));
      return db.readinessResult.upsert({ where: { storyId: row.id }, create: { storyId: row.id, ...readiness }, update: readiness });
    }),
  );
}
