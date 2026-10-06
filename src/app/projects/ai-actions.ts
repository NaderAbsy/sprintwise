"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { scoreStory } from "@/lib/readiness/rules";
import { dailyLimit, siteDailyLimit, suggestForStory } from "@/lib/server/ai";
import { db } from "@/lib/server/db";
import { requireProject, requireUser } from "@/lib/server/dal";
import { settingsOf, toStory } from "@/lib/server/readiness";
import { recordUsage } from "@/lib/server/usage";

export type SuggestState = { error?: string } | null;

/** R-4 and R-5: one AI rewrite plus Given / When / Then scenarios, for a story that isn't Ready yet. */
export async function requestSuggestion(projectId: string, storyId: string, _prev: SuggestState): Promise<SuggestState> {
  const user = await requireUser();
  const project = await requireProject(projectId);
  const row = await db.story.findFirst({ where: { id: storyId, projectId: project.id } });
  if (!row) return { error: "That story no longer exists." };

  const story = toStory(row);
  const readiness = scoreStory(story, settingsOf(project));
  if (readiness.band === "Ready") {
    return { error: "This story is already Ready. Suggestions are for stories that still need work." };
  }

  // The daily cap counts attempts, so failed calls can't be used to get around it.
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const usage = await db.aiUsage.upsert({
    where: { userId_day: { userId: user.id, day: today } },
    create: { userId: user.id, day: today, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (usage.count > dailyLimit()) {
    return { error: `You've used today's ${dailyLimit()} AI suggestions. The limit resets at midnight UTC.` };
  }
  // A site-wide ceiling too, so many accounts together can't run up the bill.
  const siteWide = await db.aiUsage.aggregate({ where: { day: today }, _sum: { count: true } });
  if ((siteWide._sum.count ?? 0) > siteDailyLimit()) {
    return { error: "AI suggestions have reached today's limit for the whole site. Try again tomorrow." };
  }

  const failedChecks = readiness.findings.map((f) => `${f.check}: ${f.reason}`);
  const result = await suggestForStory(story, failedChecks);
  if (!result.ok) return { error: result.error };

  await db.readinessResult.update({
    where: { storyId: row.id },
    data: { aiSuggestion: result.suggestion as unknown as Prisma.InputJsonValue },
  });
  await recordUsage("ai_suggestion");
  revalidatePath(`/projects/${project.id}/stories/${row.id}`);
  return null;
}
