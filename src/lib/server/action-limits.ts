import "server-only";
import { db } from "@/lib/server/db";

/**
 * How many times one account may do each heavy action per window. Generous for a
 * person at work (a refinement session re-imports a few times an hour), but they stop
 * a script from keeping Jira or the database busy.
 */
export const ACTION_LIMITS = {
  jira: { max: 40, windowMs: 10 * 60_000, what: "Jira requests" },
  import: { max: 30, windowMs: 10 * 60_000, what: "imports" },
  rescore: { max: 30, windowMs: 10 * 60_000, what: "rule changes" },
  snapshot: { max: 40, windowMs: 10 * 60_000, what: "snapshots" },
} as const;
export type LimitedAction = keyof typeof ACTION_LIMITS;

/**
 * Counts one more `action` for `userId`, in one statement so requests sent together are
 * all counted. Returns a message once the window's allowance is used up, else null.
 */
export async function overLimit(action: LimitedAction, userId: string, now = new Date()): Promise<string | null> {
  const { max, windowMs, what } = ACTION_LIMITS[action];
  const since = new Date(now.getTime() - windowMs);
  const [row] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO action_limits (key, count, "windowStart") VALUES (${`${action}:${userId}`}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN action_limits."windowStart" < ${since} THEN 1 ELSE action_limits.count + 1 END,
      "windowStart" = CASE WHEN action_limits."windowStart" < ${since} THEN ${now} ELSE action_limits."windowStart" END
    RETURNING count`;
  return row.count > max ? `That's a lot of ${what} in a few minutes. Wait ${Math.round(windowMs / 60_000)} minutes, then try again.` : null;
}
