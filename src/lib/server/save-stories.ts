import "server-only";
import { Prisma, type Project } from "@/generated/prisma/client";
import type { ImportStory } from "@/lib/csv/import";
import { db } from "@/lib/server/db";
import { readinessData, settingsOf } from "@/lib/server/readiness";
import { LimitError, lockOwner } from "@/lib/server/within-limit";

type Tx = Prisma.TransactionClient;

/** The next free rank: new stories join the bottom of the backlog. */
export async function bottomRank(projectId: string, client: Tx | typeof db = db): Promise<number> {
  const last = await client.story.aggregate({ where: { projectId }, _max: { rank: true } });
  return (last._max.rank ?? 0) + 1;
}

/**
 * Adds new keys and updates existing ones, scoring each. New stories join the
 * bottom in the given order; existing ones keep their place. What came from
 * outside (a file or Jira) replaces what was edited here, so `editedAt` clears,
 * unless `keepEdited`: then a story edited here, even one edited a moment ago
 * while Jira was being read, is left alone. `extra` runs in the same transaction.
 * With `maxStories`, throws LimitError rather than take the project past it, counted
 * under a lock so imports sent at the same moment can't each find room.
 * Returns the keys that were saved.
 */
export async function saveStories(
  project: Project,
  stories: ImportStory[],
  { extra, keepEdited = false, maxStories }: { extra?: (tx: Tx) => Promise<unknown>; keepEdited?: boolean; maxStories?: number } = {},
): Promise<Set<string>> {
  const settings = settingsOf(project);
  return db.$transaction(
    async (tx) => {
      await lockOwner(tx, { project: project.id });
      // Locking the project's stories makes an edit saved meanwhile wait for this, or be seen by it.
      const rows = await tx.$queryRaw<{ id: string; key: string; edited: boolean }[]>`
        SELECT id, key, "editedAt" IS NOT NULL AS edited FROM stories WHERE "projectId" = ${project.id} FOR UPDATE`;
      const existing = new Map(rows.map((r) => [r.key, r]));
      const fresh = stories.filter((s) => !existing.has(s.key));
      const updates = stories.filter((s) => {
        const row = existing.get(s.key);
        return row && !(keepEdited && row.edited);
      });

      if (maxStories !== undefined && existing.size + fresh.length > maxStories) {
        throw new LimitError(`This would take the project past ${maxStories} stories. Delete some stories or narrow what you bring in.`);
      }
      if (fresh.length > 0) {
        // New stories in two statements, not one each: big imports stay quick.
        const firstRank = await bottomRank(project.id, tx);
        const created = await tx.story.createManyAndReturn({
          data: fresh.map((story, i) => ({ projectId: project.id, rank: firstRank + i, ...story })),
          select: { id: true, key: true },
        });
        const byKey = new Map(fresh.map((s) => [s.key, s]));
        await tx.readinessResult.createMany({
          data: created.map(({ id, key }) => ({ storyId: id, ...readinessData(byKey.get(key)!, settings) })),
        });
      }
      for (const story of updates) {
        const readiness = readinessData(story, settings);
        await tx.story.update({
          where: { id: existing.get(story.key)!.id },
          data: {
            ...story,
            editedAt: null,
            // A changed story makes its old AI suggestion stale.
            readiness: { upsert: { create: readiness, update: { ...readiness, aiSuggestion: Prisma.DbNull } } },
          },
        });
      }
      await extra?.(tx);
      return new Set([...fresh, ...updates].map((s) => s.key));
    },
    // A 1,000-story import takes a few seconds; the default limit is five.
    { timeout: 60_000, maxWait: 10_000 },
  );
}
