import "server-only";
import { db } from "@/lib/server/db";

export type UsageEventType = "check_run" | "import" | "report_generated" | "ai_suggestion";

/** Anonymous count for the case study (story L-3). Never blocks the user's action. */
export async function recordUsage(eventType: UsageEventType) {
  await db.usageEvent.create({ data: { eventType } }).catch(() => undefined);
}
