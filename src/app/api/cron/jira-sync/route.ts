import { NextResponse, type NextRequest } from "next/server";
import { cronAllowed } from "@/lib/server/cron";
import { syncJiraProjectsNightly } from "@/lib/server/nightly-sync";

// Vercel allows five minutes; the sync stops starting new projects after four.
export const maxDuration = 300;

/** Run every night by Vercel Cron (vercel.json): syncs Jira projects with a running sprint. */
export async function GET(request: NextRequest) {
  if (!cronAllowed(request)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const result = await syncJiraProjectsNightly();
  if (result.failed > 0 || result.leftForTomorrow > 0) console.warn("Nightly Jira sync:", { ...result, synced: result.synced.length });
  return NextResponse.json(result);
}
