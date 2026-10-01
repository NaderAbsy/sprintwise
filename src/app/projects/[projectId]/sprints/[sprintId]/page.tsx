import type { Metadata } from "next";
import Link from "next/link";
import { SnapshotUploadForm } from "@/app/projects/_components/sprint-forms";
import { deleteSprint } from "@/app/projects/sprint-actions";
import { ChangeTable } from "@/components/change-table";
import { ConfirmButton } from "@/components/confirm-button";
import { SprintMetricsPanel } from "@/components/sprint-metrics";
import { formatDay, toDay } from "@/lib/sprint/dates";
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
  const uploadProps = {
    projectId: project.id,
    sprintId: sprint.id,
    rangeLabel: dayRange,
    endDay: toDay(sprint.endDate),
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">
          <Link href={`/projects/${project.id}`} className="hover:underline">
            {project.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">{sprint.name}</h1>
        <p className="mt-1 text-muted">{dayRange}</p>
        {baseline && (
          <Link href={`/projects/${project.id}/sprints/${sprint.id}/report`} className="btn-secondary mt-4">
            Open sprint report
          </Link>
        )}
      </div>

      {!baseline ? (
        <section aria-labelledby="baseline-heading" className="space-y-3">
          <h2 id="baseline-heading" className="text-lg font-semibold">
            Step 1: lock the baseline
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            Upload the sprint as the team committed to it on day one. Every later snapshot is compared against it, so
            once it&apos;s locked it can&apos;t be edited or replaced.
          </p>
          <SnapshotUploadForm mode="baseline" {...uploadProps} minDay={toDay(sprint.startDate)} />
        </section>
      ) : (
        <>
          {metrics && <SprintMetricsPanel metrics={metrics} />}

          <section aria-labelledby="upload-heading" className="space-y-3">
            <h2 id="upload-heading" className="text-lg font-semibold">
              Upload a later snapshot
            </h2>
            <p className="max-w-2xl text-sm text-muted">
              Export the sprint again and upload it. You&apos;ll see what changed since the previous snapshot before
              saving. Stories are matched by key, so a renamed story isn&apos;t counted as removed and added.
            </p>
            <SnapshotUploadForm
              mode="snapshot"
              {...uploadProps}
              minDay={toDay(latest!.asOfDate)}
              previous={latest!.items.map(toStory)}
            />
          </section>

          <section aria-labelledby="log-heading" className="space-y-3">
            <h2 id="log-heading" className="text-lg font-semibold">
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
            <h2 id="snapshots-heading" className="text-lg font-semibold">
              Snapshots
            </h2>
            <ol className="card divide-y divide-border text-sm">
              {snapshots.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                  <span className="w-28 font-medium">{formatDay(s.asOfDate)}</span>
                  {s.isBaseline && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
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

      <ConfirmButton
        label="Delete sprint"
        title={`Delete ${sprint.name}?`}
        body="This removes the sprint's baseline, snapshots and change log. The project's backlog stories are untouched."
        confirmLabel="Delete sprint"
        action={deleteSprint.bind(null, project.id, sprint.id)}
      />
    </div>
  );
}
