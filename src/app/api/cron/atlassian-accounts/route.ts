import { NextResponse, type NextRequest } from "next/server";
import { reportAtlassianAccounts } from "@/lib/server/atlassian-privacy";

/**
 * Run daily by Vercel Cron (vercel.json). Each Atlassian account ID is reported
 * only when its weekly cycle is up, so an extra call does nothing. When
 * CRON_SECRET is set, Vercel sends it and other callers are refused.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  const result = await reportAtlassianAccounts();
  if (result.error || result.retryAfterSeconds) console.warn("Atlassian personal data report:", result);
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}
