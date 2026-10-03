import type { Metadata } from "next";
import { FileText, Lock } from "lucide-react";
import Link from "next/link";
import { SnapshotUploadForm } from "@/app/projects/_components/sprint-forms";
import { deleteSprint } from "@/app/projects/sprint-actions";
import { ChangeTable } from "@/components/change-table";
import { ConfirmButton } from "@/components/confirm-button";
import { SectionHeader } from "@/components/section-header";
import { SprintMetricsPanel } from "@/components/sprint-metrics";
import { formatDay, toDay } from "@/lib/sprint/dates";
import { db } from "@/lib/server/db";
import { requireSprint } from "@/lib/server/dal";
import { toStory } from "@/lib/server/readiness";
import { loadSprint } from "@/lib/server/sprint";

export const metadata: Metadata = { title: "Sprint" };

export default async function SprintPage({ params }: PageProps<"/projects/[projectId]/sprints/[sprintId]">) {
  const { projectId, sprintId } = await params;
  const { project, sprint } = await requireSprint(projectId, sprintId);

  const { snapshots, baselineRow: baseline, latestRow: latest, metrics, log } = await loadSprint(sprint);
  const total = (items: { storyPoints: number | null }[]) => items.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  const dayRange = `${formatDay(sprint.startDate)} to ${formatDay(sprint.endDate)}`;
  const backlog = (await db.story.findMany({ where: { projectId: project.id }, orderBy: { key: "asc" } })).map((row) => ({
    id: row.id,
    ...toStory(row),
  }));
  const uploadProps = {
    backlog,
    projectId: project.id,
    sprintId: sprint.id,
    rangeLabel: dayRange,
    endDay: toDay(sprint.endDate),
  };

  const deleteButton = (
    <ConfirmButton
      label="Delete sprint"
      title={`Delete ${sprint.name}?`}
      body="This removes the sprint's baseline, snapshots and change log. The project's backlog stories are untouched."
      confirmLabel="Delete sprint"
      action={deleteSprint.bind(null, project.id, sprint.id)}
    />
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        back={{ href: `/projects/${project.id}/sprints`, label: "Sprints" }}
        title={sprint.name}
        description={dayRange}
        actions={
          <>
            {deleteButton}
            {baseline && (
              <Link href={`/projects/${project.id}/sprints/${sprint.id}/report`} className="btn-primary">
                <FileText aria-hidden="true" className="h-4 w-4" />
                Open sprint report
              </Link>
            )}
          </>
        }
      />

      {!baseline ? (
        <section aria-labelledby="baseline-heading" className="space-y-3">
          <h2 id="baseline-heading" className="font-semibold">
            Step 1: lock the baseline
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            Choose the stories the team committed to on day one, from the backlog or a CSV. Every later snapshot is
            compared against this baseline, so once it&apos;s locked it can&apos;t be edited or replaced.
          </p>
          <SnapshotUploadForm mode="baseline" {...uploadProps} minDay={toDay(sprint.startDate)} />
        </section>
      ) : (
        <>
          {metrics && <SprintMetricsPanel metrics={metrics} />}

          <section aria-labelledby="upload-heading" className="space-y-3">
            <h2 id="upload-heading" className="font-semibold">
              Save a later snapshot
            </h2>
            <p className="max-w-2xl text-sm text-muted">
              As the sprint runs, record where it stands: pick the stories from the backlog, or upload a fresh export.
              You&apos;ll see what changed before saving. Stories are matched by key, so a renamed story isn&apos;t
              counted as removed and added.
            </p>
            <SnapshotUploadForm
              mode="snapshot"
              {...uploadProps}
              minDay={toDay(latest!.asOfDate)}
              previous={latest!.items.map(toStory)}
            />
          </section>

          <section aria-labelledby="log-heading" className="space-y-3">
            <h2 id="log-heading" className="font-semibold">
              Change log
            </h2>
            {log.length === 0 ? (
              <p className="text-sm text-muted">No changes yet. The sprint matches its baseline.</p>
            ) : (
              <ChangeTable caption="Every change since the baseline, newest first" rows={log} />
            )}
            <p className="text-xs text-muted">
              CSV snapshots show between which two snapshots a change happened, not who made it.
            </p>
          </section>

          <section aria-labelledby="snapshots-heading" className="space-y-3">
            <h2 id="snapshots-heading" className="font-semibold">
              Snapshots
            </h2>
            <ol className="card divide-y divide-border text-sm">
              {snapshots.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                  <span className="w-28 font-medium">{formatDay(s.asOfDate)}</span>
                  {s.isBaseline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-foreground">
                      <Lock aria-hidden="true" className="h-3 w-3" />
                      Baseline · locked
                    </span>
                  )}
                  <span className="text-muted">
                    {s.items.length} {s.items.length === 1 ? "story" : "stories"} · {total(s.items)} points
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}


    </div>
  );
}
