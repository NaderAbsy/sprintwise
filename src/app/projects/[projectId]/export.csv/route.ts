import { backlogCsv } from "@/lib/csv/export";
import { db } from "@/lib/server/db";
import { getSession } from "@/lib/server/dal";
import { toStory } from "@/lib/server/readiness";

/** The scored backlog as CSV, for the owner only. Re-imports cleanly, so it also works as a backup. */
export async function GET(_request: Request, { params }: RouteContext<"/projects/[projectId]/export.csv">) {
  const session = await getSession();
  if (!session) return new Response("Sign in to export.", { status: 401 });
  const { projectId } = await params;
  const project = await db.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) return new Response("Not found.", { status: 404 });

  const stories = await db.story.findMany({ where: { projectId: project.id }, include: { readiness: true }, orderBy: { key: "asc" } });
  const csv = backlogCsv(
    stories.map((s) => ({
      ...toStory(s),
      score: s.readiness?.score ?? null,
      band: s.readiness?.band ?? null,
      failedChecks: Array.isArray(s.readiness?.failedRules)
        ? (s.readiness.failedRules as { check?: unknown }[]).map((r) => String(r.check ?? "")).filter(Boolean)
        : [],
    })),
  );
  const filename = `${project.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "backlog"}-backlog.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
