import "server-only";
import { Prisma, type Project } from "@/generated/prisma/client";
import type { ImportStory } from "@/lib/csv/import";
import { db } from "@/lib/server/db";
import { readinessData, settingsOf } from "@/lib/server/readiness";

/** The next free rank: new stories join the bottom of the backlog. */
export async function bottomRank(projectId: string): Promise<number> {
  const last = await db.story.aggregate({ where: { projectId }, _max: { rank: true } });
  return (last._max.rank ?? 0) + 1;
}

/**
 * Adds new keys and updates existing ones, scoring each. New stories join the
 * bottom in the given order; existing ones keep their place. What came from
 * outside (a file or Jira) replaces what was edited here, so `editedAt` clears.
 */
export async function saveStories(project: Project, stories: ImportStory[], extra: Prisma.PrismaPromise<unknown>[] = []) {
  const settings = settingsOf(project);
  const firstRank = await bottomRank(project.id);
  await db.$transaction([
    ...stories.map((story, i) => {
      const readiness = readinessData(story, settings);
      return db.story.upsert({
        where: { projectId_key: { projectId: project.id, key: story.key } },
        create: { projectId: project.id, rank: firstRank + i, ...story, readiness: { create: readiness } },
        update: {
          ...story,
          editedAt: null,
          // A changed story makes its old AI suggestion stale.
          readiness: { upsert: { create: readiness, update: { ...readiness, aiSuggestion: Prisma.DbNull } } },
        },
      });
    }),
    ...extra,
  ]);
}
