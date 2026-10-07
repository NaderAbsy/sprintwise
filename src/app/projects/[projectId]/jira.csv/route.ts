import { jiraCsv } from "@/lib/csv/export";
import { db } from "@/lib/server/db";
import { getSession } from "@/lib/server/dal";
import { toStory } from "@/lib/server/readiness";

/** The stories edited in Sprintwise and not yet marked as copied to Jira, for the owner only. */
export async function GET(_request: Request, { params }: RouteContext<"/projects/[projectId]/jira.csv">) {
  const session = await getSession();
  if (!session) return new Response("Sign in to export.", { status: 401 });
  const { projectId } = await params;
  const project = await db.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) return new Response("Not found.", { status: 404 });

  const stories = await db.story.findMany({
    where: { projectId: project.id, editedAt: { not: null } },
    orderBy: [{ rank: "asc" }, { key: "asc" }],
  });
  const filename = `${project.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "backlog"}-for-jira.csv`;
  return new Response(jiraCsv(stories.map(toStory)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
