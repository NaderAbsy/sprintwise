import type { Metadata } from "next";
import Link from "next/link";
import { ShareLink } from "@/app/projects/_components/share-link";
import { disableReportShare, enableReportShare } from "@/app/projects/sprint-actions";
import { SprintReport } from "@/components/sprint-report";
import { requireSprint } from "@/lib/server/dal";
import { settingsOf, toStory } from "@/lib/server/readiness";
import { doneStatusesOf, loadSprint } from "@/lib/server/sprint";
import { recordUsage } from "@/lib/server/usage";

export const metadata: Metadata = { title: "Sprint report" };

export default async function SprintReportPage({ params }: PageProps<"/projects/[projectId]/sprints/[sprintId]/report">) {
  const { projectId, sprintId } = await params;
  const { project, sprint } = await requireSprint(projectId, sprintId);
  const { baseline, latest, latestRow, log, snapshots } = await loadSprint(sprint, doneStatusesOf(project));
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
      doneStatuses={doneStatusesOf(project)}
      snapshots={snapshots.map((s) => ({ asOfDate: s.asOfDate, items: s.items.map(toStory) }))}
      back={{ href: back, label: `Back to ${sprint.name}` }}
      actions={
        <ShareLink
          token={sprint.shareToken}
          path="/share"
          title="Share this report"
          description="Anyone with the link can view this report, read-only, without an account. They can't see anything else in your project. You can turn the link off at any time."
          enable={enableReportShare.bind(null, project.id, sprint.id)}
          disable={disableReportShare.bind(null, project.id, sprint.id)}
        />
      }
    />
  );
}
