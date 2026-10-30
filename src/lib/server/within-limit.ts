import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { MAX_SNAPSHOT_BYTES_PER_ACCOUNT, MAX_SNAPSHOT_ITEMS_PER_ACCOUNT, MAX_STORIES_PER_ACCOUNT } from "@/lib/limits";
import { db } from "@/lib/server/db";

type Tx = Prisma.TransactionClient;

/** How many story copies an account keeps across all its sprint snapshots, and how much text they hold. */
export async function storedSnapshotItems(userId: string, client: Tx | typeof db = db): Promise<{ count: number; bytes: number }> {
  const [row] = await client.$queryRaw<{ count: bigint; bytes: bigint }[]>`
    SELECT COUNT(*) AS count,
           COALESCE(SUM(octet_length(i.title) + octet_length(i.description) + octet_length(i."acceptanceCriteria")), 0) AS bytes
    FROM snapshot_items i
    JOIN snapshots s ON s.id = i."snapshotId"
    JOIN sprints sp ON sp.id = s."sprintId"
    JOIN projects p ON p.id = sp."projectId"
    WHERE p."userId" = ${userId}`;
  return { count: Number(row?.count ?? 0), bytes: Number(row?.bytes ?? 0) };
}

const textBytes = (items: { title: string; description: string; acceptanceCriteria: string }[]) =>
  items.reduce((sum, i) => sum + Buffer.byteLength(i.title) + Buffer.byteLength(i.description) + Buffer.byteLength(i.acceptanceCriteria), 0);

/**
 * The message when saving `items` would pass the account's snapshot caps, else null.
 * Call it inside the transaction that saves them, after lockOwner(tx, { user }), so
 * saves sent together are counted one after the other.
 */
export async function snapshotRoom(
  tx: Tx,
  userId: string,
  items: { title: string; description: string; acceptanceCriteria: string }[],
): Promise<string | null> {
  const stored = await storedSnapshotItems(userId, tx);
  if (stored.count + items.length > MAX_SNAPSHOT_ITEMS_PER_ACCOUNT) {
    return `Your sprints already keep ${MAX_SNAPSHOT_ITEMS_PER_ACCOUNT.toLocaleString("en")} story copies, the most one account can. Delete old sprints to make room.`;
  }
  if (stored.bytes + textBytes(items) > MAX_SNAPSHOT_BYTES_PER_ACCOUNT) {
    return `Your sprints' snapshots already hold ${Math.round(MAX_SNAPSHOT_BYTES_PER_ACCOUNT / 1024 / 1024)} MB of story text, the most one account can. Delete old sprints to make room.`;
  }
  return null;
}

/**
 * The message when adding `adding` stories would take the account past its story cap, else null. Counted without a
 * lock across projects, so saves sent at the same moment can overshoot a little; each project's own cap still holds exactly.
 */
export async function storyRoom(client: Tx | typeof db, userId: string, adding: number): Promise<string | null> {
  const stored = await client.story.count({ where: { project: { userId } } });
  if (stored + adding <= MAX_STORIES_PER_ACCOUNT) return null;
  return `Your account already holds ${stored.toLocaleString("en")} stories, and the most one account can keep is ${MAX_STORIES_PER_ACCOUNT.toLocaleString("en")}. Delete stories or projects you no longer need to make room.`;
}

/** A limit reached; `message` says which and what to do. */
export class LimitError extends Error {}

/** Locks the row that owns what's being added, so two requests at the same moment are counted one after the other. */
export async function lockOwner(tx: Tx, owner: { project: string } | { user: string }) {
  if ("project" in owner) await tx.$queryRaw`SELECT id FROM projects WHERE id = ${owner.project} FOR UPDATE`;
  else await tx.$queryRaw`SELECT id FROM users WHERE id = ${owner.user} FOR UPDATE`;
}

/**
 * Adds something only while the count stays within `max`: the owner is locked and
 * the count taken inside the same transaction, so requests sent together can't each
 * see room for one more. Throws LimitError with `message` when there's no room.
 */
export function withinLimit<T>(
  owner: { project: string } | { user: string },
  { count, max, message }: { count: (tx: Tx) => Promise<number>; max: number; message: string },
  create: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await lockOwner(tx, owner);
    if ((await count(tx)) >= max) throw new LimitError(message);
    return create(tx);
  });
}
