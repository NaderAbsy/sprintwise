import "server-only";
import { funnel, weeklyCounts } from "@/lib/insights";
import { db } from "@/lib/server/db";
import { lastRuns } from "@/lib/server/job-runs";

const EVENT_LABELS: Record<string, string> = {
  check_run: "Stories checked",
  import: "Imports",
  report_generated: "Reports opened",
  ai_suggestion: "AI suggestions",
};

/**
 * Totals for the site owner, read from data Sprintwise keeps anyway: no new tracking, and nothing that
 * says who. `leaveOut` is the owner's own account, so their testing doesn't count.
 */
export async function loadInsights(leaveOut: string, now = new Date()) {
  const others = { id: { not: leaveOut } };
  const count = (where: object) => db.user.count({ where: { ...others, ...where } });
  const sprintWith = (isBaseline: boolean) => ({ projects: { some: { sprints: { some: { snapshots: { some: { isBaseline } } } } } } });

  const [signedUp, withProject, withStories, withBaseline, tracked, jira, shared, recent, events, jobs] = await Promise.all([
    count({}),
    count({ projects: { some: {} } }),
    count({ projects: { some: { stories: { some: {} } } } }),
    count(sprintWith(true)),
    count(sprintWith(false)),
    count({ accounts: { some: { providerId: "atlassian" } } }),
    count({ projects: { some: { OR: [{ shareToken: { not: null } }, { sprints: { some: { shareToken: { not: null } } } }] } } }),
    db.user.findMany({ where: { ...others, createdAt: { gte: new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000) } }, select: { createdAt: true } }),
    db.$queryRaw<{ month: string; event: string; count: number }[]>`
      SELECT to_char(date_trunc('month', "createdAt"), 'Mon YYYY') AS month, "eventType" AS event, count(*)::int AS count
      FROM usage_events
      WHERE "createdAt" >= date_trunc('month', now()) - interval '5 months'
      GROUP BY date_trunc('month', "createdAt"), 1, 2
      ORDER BY date_trunc('month', "createdAt") DESC, 2`,
    lastRuns(),
  ]);

  return {
    jobs,
    steps: funnel([
      { label: "Signed up", hint: "Accounts created", count: signedUp },
      { label: "Created a project", hint: "At least one project", count: withProject },
      { label: "Added stories", hint: "Pasted, imported from CSV or Jira, or loaded the samples", count: withStories },
      { label: "Locked a sprint baseline", hint: "Started tracking a sprint", count: withBaseline },
      { label: "Tracked a sprint", hint: "A later snapshot, so scope change can be measured", count: tracked },
    ]),
    signals: [
      { label: "Connected Jira", count: jira },
      { label: "Shared a backlog or report link", count: shared },
    ],
    weeks: weeklyCounts(
      recent.map((u) => u.createdAt),
      now,
    ),
    months: [...new Set(events.map((e) => e.month))].map((month) => ({
      month,
      counts: Object.entries(EVENT_LABELS).map(([event, label]) => ({
        label,
        count: events.find((e) => e.month === month && e.event === event)?.count ?? 0,
      })),
    })),
  };
}
