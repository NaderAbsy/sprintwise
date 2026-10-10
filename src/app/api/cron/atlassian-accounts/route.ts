import { NextResponse, type NextRequest } from "next/server";
import { reportAtlassianAccounts } from "@/lib/server/atlassian-privacy";
import { deleteExpiredAuthData } from "@/lib/server/cleanup";
import { cronAllowed } from "@/lib/server/cron";
import { runJob } from "@/lib/server/job-runs";

/**
 * Run daily by Vercel Cron (vercel.json). Each Atlassian account ID is reported
 * only when its weekly cycle is up, so an extra call does nothing. The same
 * daily call deletes sign-in data that has expired (see cleanup.ts).
 */
export async function GET(request: NextRequest) {
  if (!cronAllowed(request)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const { result, cleanedUp } = await runJob(
    "atlassian-accounts",
    async () => ({ cleanedUp: await deleteExpiredAuthData(), result: await reportAtlassianAccounts() }),
    ({ result, cleanedUp }) => ({
      ok: !result.error,
      summary: [
        result.error ?? `Reported ${result.reported} Atlassian ${result.reported === 1 ? "account" : "accounts"}${result.closed ? `, ${result.closed} closed` : ""}`,
        result.retryAfterSeconds ? "Atlassian asked to wait; the rest go next time" : "",
        `cleared ${cleanedUp.sessions} ended sessions and ${cleanedUp.rateLimits} old sign-in counts`,
      ]
        .filter(Boolean)
        .join("; ") + ".",
    }),
  );
  if (result.error || result.retryAfterSeconds) console.warn("Atlassian personal data report:", result);
  return NextResponse.json({ ...result, cleanedUp }, { status: result.error ? 502 : 200 });
}
