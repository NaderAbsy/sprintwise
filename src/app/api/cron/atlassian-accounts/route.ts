import { NextResponse, type NextRequest } from "next/server";
import { reportAtlassianAccounts } from "@/lib/server/atlassian-privacy";
import { deleteExpiredAuthData } from "@/lib/server/cleanup";
import { cronAllowed } from "@/lib/server/cron";

/**
 * Run daily by Vercel Cron (vercel.json). Each Atlassian account ID is reported
 * only when its weekly cycle is up, so an extra call does nothing. The same
 * daily call deletes sign-in data that has expired (see cleanup.ts).
 */
export async function GET(request: NextRequest) {
  if (!cronAllowed(request)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const cleanedUp = await deleteExpiredAuthData();
  const result = await reportAtlassianAccounts();
  if (result.error || result.retryAfterSeconds) console.warn("Atlassian personal data report:", result);
  return NextResponse.json({ ...result, cleanedUp }, { status: result.error ? 502 : 200 });
}
