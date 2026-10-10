import "server-only";
import { db } from "@/lib/server/db";
import { jiraAccount, jiraConfigured } from "@/lib/server/jira";
import { syncProjectFromJira } from "@/lib/server/jira-sync";
import { utcToday } from "@/lib/sprint/tracking";

/** Stop starting new projects after this long; the function has five minutes, and one sync takes seconds. */
const BUDGET_MS = 4 * 60 * 1000;

export type NightlyResult = { synced: string[]; failed: number; leftForTomorrow: number };

/**
 * Syncs every project that has a Jira search, has nightly sync on, and has a
 * sprint that follows the backlog running today (or that ended yesterday, as
 * it may still be the last day where the owner is). Each uses its owner's own
 * Jira connection. A sync that can't run leaves its reason on the project for
 * the backlog to show; the others carry on.
 */
export async function syncJiraProjectsNightly(now = Date.now()): Promise<NightlyResult> {
  if (!jiraConfigured) return { synced: [], failed: 0, leftForTomorrow: 0 };
  const today = utcToday();
  const dayBefore = new Date(today.getTime() - 86_400_000);
  const projects = await db.project.findMany({
    where: {
      jiraCloudId: { not: null },
      jiraJql: { not: null },
      nightlySync: true,
      sprints: { some: { tracksBacklog: true, startDate: { lte: today }, endDate: { gte: dayBefore } } },
    },
    // The longest-waiting first, so a project skipped one night goes early the next.
    orderBy: { jiraSyncedAt: { sort: "asc", nulls: "first" } },
  });

  const result: NightlyResult = { synced: [], failed: 0, leftForTomorrow: 0 };
  for (const [i, project] of projects.entries()) {
    if (Date.now() - now > BUDGET_MS) {
      result.leftForTomorrow = projects.length - i;
      break;
    }
    const error = !(await jiraAccount(project.userId))
      ? "Jira isn't connected to your account. Connect it from the Import page."
      : (await syncProjectFromJira(project, project.userId, { automatic: true }).catch(() => ({ error: "Something went wrong." }))).error;
    if (error) {
      result.failed++;
      await db.project.update({ where: { id: project.id }, data: { jiraSyncError: error } });
    } else {
      result.synced.push(project.id);
    }
  }
  return result;
}
