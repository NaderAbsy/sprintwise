import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { reportAtlassianAccounts } from "@/lib/server/atlassian-privacy";
import { deleteExpiredAuthData } from "@/lib/server/cleanup";

/** Whether the request carries CRON_SECRET, compared in constant time. */
function authorised(request: NextRequest, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Run daily by Vercel Cron (vercel.json), which sends CRON_SECRET. On Vercel the
 * route refuses every other caller, and refuses all calls until CRON_SECRET is
 * set. Locally and in tests it runs without one. Each Atlassian account ID is
 * reported only when its weekly cycle is up, so an extra call does nothing.
 * The same daily call deletes sign-in data that has expired (see cleanup.ts).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret ? !authorised(request, secret) : Boolean(process.env.VERCEL_ENV)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  const cleanedUp = await deleteExpiredAuthData();
  const result = await reportAtlassianAccounts();
  if (result.error || result.retryAfterSeconds) console.warn("Atlassian personal data report:", result);
  return NextResponse.json({ ...result, cleanedUp }, { status: result.error ? 502 : 200 });
}
