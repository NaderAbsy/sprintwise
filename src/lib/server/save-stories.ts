import "server-only";
import { Prisma, type Project } from "@/generated/prisma/client";
import type { ImportStory } from "@/lib/csv/import";
import { db } from "@/lib/server/db";
import { readinessData, settingsOf, toStory } from "@/lib/server/readiness";
import { LimitError, lockOwner, storyRoom } from "@/lib/server/within-limit";
import { baseOf, mergeEdited, readBase } from "@/lib/stories/jira-merge";

type Tx = Prisma.TransactionClient;

/** Story fields an import can fill; a file without one of the optional columns leaves it as it is. */
export type StoryField = Exclude<keyof ImportStory, "key">;

/** The next free rank: new stories join the bottom of the backlog. */
export async function bottomRank(projectId: string, client: Tx | typeof db = db): Promise<number> {
  const last = await client.story.aggregate({ where: { projectId }, _max: { rank: true } });
  return (last._max.rank ?? 0) + 1;
}

/**
 * Adds new keys and updates existing ones, scoring each. New stories join the
 * bottom in the given order; existing ones keep their place.
 *
 * - An import (`merge` off) replaces what was edited here, so `editedAt` clears.
 *   With `fields`, only those fields come from the file: a file without a
 *   Description column doesn't blank the descriptions already saved.
 * - A sync (`merge` on) leaves edits made here alone, field by field: a story
 *   whose points were edited here still takes Jira's new description and status.
 *   That includes a story edited a moment ago, while Jira was being read.
 * - `fromJira` remembers each story's Jira version (`jiraBase`), so later syncs
 *   and sends can tell an edit here from a change in Jira.
 *
 * The project's rule settings are read under the lock, so a settings change saved
 * while Jira was being read is the one the scores use. `extra` runs in the same
 * transaction. With `maxStories`, throws LimitError rather than take the project
 * past it, counted under the lock so imports sent at the same moment can't each
 * find room. Returns the keys saved and how many still have edits to send.
 */
export async function saveStories(
  project: Project,
  stories: ImportStory[],
  {
    extra,
    merge = false,
    fromJira = false,
    fields,
    maxStories,
  }: { extra?: (tx: Tx) => Promise<unknown>; merge?: boolean; fromJira?: boolean; fields?: ReadonlySet<StoryField>; maxStories?: number } = {},
): Promise<{ saved: Set<string>; stillEdited: number }> {
  return db.$transaction(
    async (tx) => {
      await lockOwner(tx, { project: project.id });
      const settings = settingsOf(
        await tx.project.findUniqueOrThrow({ where: { id: project.id }, select: { maxPoints: true, vagueWords: true, customChecks: true } }),
      );
      // Locking the project's stories makes an edit saved meanwhile wait for this, or be seen by it.
      const rows = await tx.$queryRaw<{ id: string; key: string; edited: boolean }[]>`
        SELECT id, key, "editedAt" IS NOT NULL AS edited FROM stories WHERE "projectId" = ${project.id} FOR UPDATE`;
      const existing = new Map(rows.map((r) => [r.key, r]));
      const fresh = stories.filter((s) => !existing.has(s.key));
      const updates = stories.filter((s) => existing.has(s.key));

      if (maxStories !== undefined && existing.size + fresh.length > maxStories) {
        throw new LimitError(`This would take the project past ${maxStories} stories. Delete some stories or narrow what you bring in.`);
      }
      if (fresh.length > 0) {
        const roomLeft = await storyRoom(tx, project.userId, fresh.length);
        if (roomLeft) throw new LimitError(roomLeft);
        // New stories in two statements, not one each: big imports stay quick.
        const firstRank = await bottomRank(project.id, tx);
        const created = await tx.story.createManyAndReturn({
          data: fresh.map((story, i) => ({
            projectId: project.id,
            rank: firstRank + i,
            ...story,
            ...(fromJira && { jiraBase: baseOf(story) }),
          })),
          select: { id: true, key: true },
        });
        const byKey = new Map(fresh.map((s) => [s.key, s]));
        await tx.readinessResult.createMany({
          data: created.map(({ id, key }) => ({ storyId: id, ...readinessData(byKey.get(key)!, settings) })),
        });
      }

      // The saved rows are needed where the new version doesn't simply replace them.
      const partial = fields !== undefined && !merge;
      const needed = updates.filter((s) => partial || (merge && existing.get(s.key)!.edited)).map((s) => existing.get(s.key)!.id);
      const saved = new Map(
        (needed.length > 0 ? await tx.story.findMany({ where: { id: { in: needed } } }) : []).map((row) => [row.key, row]),
      );

      let stillEdited = 0;
      for (const story of updates) {
        const row = saved.get(story.key);
        let data: Prisma.StoryUpdateInput;
        if (merge && row?.editedAt) {
          const merged = mergeEdited(toStory(row), readBase(row.jiraBase), story);
          if (merged.edited) stillEdited++;
          data = {
            ...merged.values,
            // Status, epic and type are never edited here for Jira, so Jira's always count.
            status: story.status,
            epic: story.epic,
            issueType: story.issueType,
            jiraBase: merged.base ?? Prisma.DbNull,
            ...(!merged.edited && { editedAt: null }),
          };
        } else if (partial && row) {
          const kept = (field: StoryField) => !fields.has(field);
          data = {
            ...story,
            ...(kept("description") && { description: row.description }),
            ...(kept("acceptanceCriteria") && { acceptanceCriteria: row.acceptanceCriteria }),
            ...(kept("storyPoints") && { storyPoints: row.storyPoints }),
            ...(kept("status") && { status: row.status }),
            ...(kept("epic") && { epic: row.epic }),
            ...(kept("issueType") && { issueType: row.issueType }),
            editedAt: null,
            jiraBase: fromJira ? baseOf(story) : Prisma.DbNull,
          };
        } else {
          data = { ...story, editedAt: null, jiraBase: fromJira ? baseOf(story) : Prisma.DbNull };
        }
        const scored = { ...story, ...(data as Partial<ImportStory>) };
        const readiness = readinessData(scored, settings);
        await tx.story.update({
          where: { id: existing.get(story.key)!.id },
          data: {
            ...data,
            // A changed story makes its old AI suggestion stale.
            readiness: { upsert: { create: readiness, update: { ...readiness, aiSuggestion: Prisma.DbNull } } },
          },
        });
      }
      await extra?.(tx);
      return { saved: new Set([...fresh, ...updates].map((s) => s.key)), stillEdited };
    },
    // A 1,000-story import takes a few seconds; the default limit is five.
    { timeout: 60_000, maxWait: 10_000 },
  );
}
