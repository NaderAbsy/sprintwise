import "server-only";
import { db } from "@/lib/server/db";

/**
 * What the site owner's Insights page counts as suspicious, with no detail of who or what:
 * - limit_hit: someone went over an account limit (imports, Jira calls, edits...)
 * - auth_limited: the sign-in endpoints refused a visitor for too many requests
 * - auth_refused: a sign-in request was refused for a foreign origin or an address it may not go to
 * - cron_denied: a nightly job was called without the right secret
 */
export const SECURITY_EVENTS = {
  limit_hit: "Went over an account limit",
  auth_limited: "Sign-in refused: too many requests",
  auth_refused: "Sign-in refused: foreign origin or address",
  cron_denied: "Nightly job called without its secret",
} as const;
export type SecurityEvent = keyof typeof SECURITY_EVENTS;

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/**
 * Counts one more `kind` for today, in one statement. Callers wait for it, so the write isn't cut short when the
 * response goes out; a refused request already costs a database write in the rate limiter, so this adds little. It
 * never throws and never blocks the request on a failure.
 */
export async function recordSecurityEvent(kind: SecurityEvent, now = new Date()): Promise<void> {
  await db
    .$executeRaw`
      INSERT INTO security_counts (day, kind, count) VALUES (${utcDay(now)}, ${kind}, 1)
      ON CONFLICT (day, kind) DO UPDATE SET count = security_counts.count + 1`.catch(() => undefined);
}

/** Daily totals for the last `days` days (today included), newest first, for the Insights page. */
export async function securityCounts(days = 30, now = new Date()) {
  const since = utcDay(new Date(now.getTime() - (days - 1) * 86_400_000));
  const rows = await db.securityCount.findMany({ where: { day: { gte: since, lte: utcDay(now) } }, orderBy: [{ day: "desc" }, { kind: "asc" }] });
  const totals = Object.fromEntries(Object.keys(SECURITY_EVENTS).map((k) => [k, 0])) as Record<SecurityEvent, number>;
  for (const row of rows) if (row.kind in totals) totals[row.kind as SecurityEvent] += row.count;
  const today = utcDay(now);
  const todayCounts = Object.fromEntries(rows.filter((r) => r.day === today).map((r) => [r.kind, r.count])) as Partial<Record<SecurityEvent, number>>;
  return { totals, today: todayCounts };
}
