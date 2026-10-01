import "server-only";
import type { Prisma, Project, Story as StoryRow } from "@/generated/prisma/client";
import { DEFAULT_VAGUE_WORDS, scoreStory, type RuleSettings } from "@/lib/readiness/rules";
import type { Story } from "@/lib/stories/types";

export const projectDefaults = { maxPoints: 8, vagueWords: DEFAULT_VAGUE_WORDS };

export function settingsOf(project: Pick<Project, "maxPoints" | "vagueWords">): RuleSettings {
  return { maxPoints: project.maxPoints, vagueWords: project.vagueWords };
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
    failedRules: result.rules
      .filter((r) => !r.passed)
      .map(({ id, check, reason }) => ({ id, check, reason })) as Prisma.InputJsonValue,
    rulesVersion: result.rulesVersion,
    settingsUsed: settings as unknown as Prisma.InputJsonValue,
  };
}
