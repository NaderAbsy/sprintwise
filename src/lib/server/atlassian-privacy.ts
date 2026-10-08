import "server-only";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jiraConfigured, jiraFake } from "@/lib/server/jira";

/**
 * Atlassian's personal data reporting, which every app that stores Atlassian
 * account IDs must do. Sprintwise stores only the account ID (and tokens) of
 * each connected Jira account. Each ID is reported once per cycle (7 days
 * unless Atlassian says otherwise); when Atlassian answers that the account
 * was closed, the connection is deleted. Sprintwise keeps no Atlassian profile
 * data, so "updated" needs nothing done.
 * https://developer.atlassian.com/cloud/jira/platform/user-privacy-developer-guide/
 */

const REPORT_URL = "https://api.atlassian.com/app/report-accounts/";
/** Atlassian accepts up to 90 accounts per request. */
export const REPORT_BATCH = 90;
const DEFAULT_CYCLE_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredAccount = { accountId: string; updatedAt: Date };

/** The account IDs due for a report: never reported, or their cycle is up. One entry per ID, newest data first. */
export function dueAccounts(accounts: StoredAccount[], nextReportAt: Map<string, Date>, now: Date): StoredAccount[] {
  const newest = new Map<string, StoredAccount>();
  for (const a of accounts) {
    const seen = newest.get(a.accountId);
    if (!seen || a.updatedAt > seen.updatedAt) newest.set(a.accountId, a);
  }
  return [...newest.values()].filter((a) => {
    const next = nextReportAt.get(a.accountId);
    return !next || next <= now;
  });
}

/** Atlassian's Cycle-Period header (seconds) as milliseconds, or 7 days when it's missing or odd. */
export function cyclePeriod(header: string | null): number {
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 3600 ? seconds * 1000 : DEFAULT_CYCLE_MS;
}

/** The account IDs Atlassian says were closed, from a 200 answer. */
export function closedAccounts(body: unknown): string[] {
  const accounts = (body as { accounts?: { accountId?: unknown; status?: unknown }[] } | null)?.accounts ?? [];
  return accounts.filter((a) => a.status === "closed" && typeof a.accountId === "string").map((a) => a.accountId as string);
}

export type ReportResult = { reported: number; closed: number; retryAfterSeconds?: number; error?: string };

/** A valid access token from any connected account; Atlassian accepts any token issued to this app. */
async function anyToken(accounts: { id: string; userId: string }[]): Promise<string | null> {
  for (const a of accounts) {
    try {
      const { accessToken } = await auth.api.getAccessToken({ body: { accountId: a.id, userId: a.userId } });
      if (accessToken) return accessToken;
    } catch {
      // Expired or revoked; try the next one.
    }
  }
  return null;
}

export async function reportAtlassianAccounts(now = new Date()): Promise<ReportResult> {
  if (jiraFake || !jiraConfigured) return { reported: 0, closed: 0 };
  const accounts = await db.account.findMany({
    where: { providerId: "atlassian" },
    select: { id: true, userId: true, accountId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const reports = await db.atlassianReport.findMany();
  // Forget IDs that are no longer stored: disconnected accounts need no report.
  const stored = new Set(accounts.map((a) => a.accountId));
  const gone = reports.filter((r) => !stored.has(r.accountId)).map((r) => r.accountId);
  if (gone.length > 0) await db.atlassianReport.deleteMany({ where: { accountId: { in: gone } } });

  const due = dueAccounts(accounts, new Map(reports.map((r) => [r.accountId, r.nextReportAt])), now);
  if (due.length === 0) return { reported: 0, closed: 0 };
  const token = await anyToken(accounts);
  if (!token) return { reported: 0, closed: 0, error: "No connected Atlassian account has a valid token." };

  let reported = 0;
  let closed = 0;
  for (let i = 0; i < due.length; i += REPORT_BATCH) {
    const batch = due.slice(i, i + REPORT_BATCH);
    const response = await fetch(REPORT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ accounts: batch.map((a) => ({ accountId: a.accountId, updatedAt: a.updatedAt.toISOString() })) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 429) return { reported, closed, retryAfterSeconds: Number(response.headers.get("Retry-After")) || undefined };
    if (response.status !== 200 && response.status !== 204) {
      return { reported, closed, error: `Atlassian answered ${response.status}.` };
    }
    const closedIds = response.status === 200 ? closedAccounts(await response.json().catch(() => null)) : [];
    if (closedIds.length > 0) {
      // A closed Atlassian account: delete its connection (tokens and ID) and its report row.
      await db.account.deleteMany({ where: { providerId: "atlassian", accountId: { in: closedIds } } });
      await db.atlassianReport.deleteMany({ where: { accountId: { in: closedIds } } });
      closed += closedIds.length;
    }
    const nextReportAt = new Date(now.getTime() + cyclePeriod(response.headers.get("Cycle-Period")));
    const kept = batch.filter((a) => !closedIds.includes(a.accountId));
    await db.$transaction(
      kept.map((a) =>
        db.atlassianReport.upsert({
          where: { accountId: a.accountId },
          create: { accountId: a.accountId, nextReportAt },
          update: { nextReportAt },
        }),
      ),
    );
    reported += batch.length;
  }
  return { reported, closed };
}
