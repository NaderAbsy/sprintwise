import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const calls: { table: string; where: unknown }[] = [];
const table = (name: string) => ({
  deleteMany: ({ where }: { where: unknown }) => {
    calls.push({ table: name, where });
    return { count: 2 };
  },
});
vi.mock("@/lib/server/db", () => ({
  db: {
    session: table("session"),
    verification: table("verification"),
    rateLimit: table("rateLimit"),
    actionLimit: table("actionLimit"),
    usageEvent: table("usageEvent"),
    securityCount: table("securityCount"),
    $transaction: async (ops: unknown[]) => ops,
  },
}));

const { deleteExpiredAuthData } = await import("@/lib/server/cleanup");

describe("deleteExpiredAuthData", () => {
  it("deletes ended sessions, expired checks and attempt counts older than a day", async () => {
    const now = new Date("2026-10-10T03:00:00Z");
    expect(await deleteExpiredAuthData(now)).toEqual({ sessions: 2, verifications: 2, rateLimits: 2, usageEvents: 2, securityCounts: 2 });
    expect(calls).toEqual([
      { table: "session", where: { expiresAt: { lt: now } } },
      { table: "verification", where: { expiresAt: { lt: now } } },
      { table: "rateLimit", where: { lastRequest: { lt: BigInt(now.getTime() - 24 * 60 * 60 * 1000) } } },
      { table: "actionLimit", where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } },
      // Usage counts older than Insights shows (about six months) and refusal counts older than 90 days.
      { table: "usageEvent", where: { createdAt: { lt: new Date(now.getTime() - 190 * 24 * 60 * 60 * 1000) } } },
      { table: "securityCount", where: { day: { lt: "2026-07-12" } } },
    ]);
  });
});
