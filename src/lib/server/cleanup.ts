import "server-only";
import { db } from "@/lib/server/db";

/** Sign-in attempt counts only matter for a minute or so; a day is generous. */
const RATE_LIMIT_KEEP_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes sign-in data that has done its job: ended sessions (each holds an IP address and browser
 * type), expired sign-in checks, and attempt counts, which are keyed by the visitor's IP address
 * whether or not they have an account. Better Auth removes some of these when it next reads them;
 * this catches the rest. Run daily by the cron route.
 */
export async function deleteExpiredAuthData(now = new Date()) {
  const [sessions, verifications, rateLimits] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(now.getTime() - RATE_LIMIT_KEEP_MS) } } }),
  ]);
  return { sessions: sessions.count, verifications: verifications.count, rateLimits: rateLimits.count };
}
