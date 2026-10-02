import type { Metadata } from "next";
import Link from "next/link";
import { SprintReport } from "@/components/sprint-report";
import { requireSprint } from "@/lib/server/dal";
import { settingsOf } from "@/lib/server/readiness";
import { loadSprint } from "@/lib/server/sprint";
import { recordUsage } from "@/lib/server/usage";

export const metadata: Metadata = { title: "Sprint report" };

export default async function SprintReportPage({ params }: PageProps<"/projects/[projectId]/sprints/[sprintId]/report">) {
  const { projectId, sprintId } = await params;
  const { project, sprint } = await requireSprint(projectId, sprintId);
  const { baseline, latest, latestRow, log } = await loadSprint(sprint);
  const back = `/projects/${project.id}/sprints/${sprint.id}`;

  if (!baseline || !latest || !latestRow) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Sprint report</h1>
        <p className="text-muted">Lock a baseline first; the report compares every later snapshot against it.</p>
        <Link href={back} className="btn-secondary">
          Back to the sprint
        </Link>
      </div>
    );
  }

  await recordUsage("report_generated");
  return (
    <SprintReport
      projectName={project.name}
      sprint={sprint}
      baseline={baseline}
      latest={latest}
      latestAsOf={latestRow.asOfDate}
      log={log}
      settings={settingsOf(project)}
      back={{ href: back, label: `Back to ${sprint.name}` }}
    />
  );
}
