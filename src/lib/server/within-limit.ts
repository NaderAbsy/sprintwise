import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { MAX_SNAPSHOT_ITEMS_PER_ACCOUNT } from "@/lib/limits";
import { db } from "@/lib/server/db";

type Tx = Prisma.TransactionClient;

/** How many stories an account keeps across all its sprint snapshots. */
export function storedSnapshotItems(userId: string, client: Tx | typeof db = db): Promise<number> {
  return client.snapshotItem.count({ where: { snapshot: { sprint: { project: { userId } } } } });
}

/** The message when saving `adding` more would pass MAX_SNAPSHOT_ITEMS_PER_ACCOUNT, else null. */
export async function snapshotRoom(userId: string, adding: number): Promise<string | null> {
  if ((await storedSnapshotItems(userId)) + adding <= MAX_SNAPSHOT_ITEMS_PER_ACCOUNT) return null;
  return `Your sprints already keep ${MAX_SNAPSHOT_ITEMS_PER_ACCOUNT.toLocaleString("en")} story copies, the most one account can. Delete old sprints to make room.`;
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
