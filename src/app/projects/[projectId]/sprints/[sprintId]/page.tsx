import type { Metadata } from "next";
import { FileText, Lock } from "lucide-react";
import Link from "next/link";
import { ReasonSelect, SprintGoalForm } from "@/app/projects/_components/sprint-goal";
import { QuickField, StatusOptions } from "@/app/projects/_components/quick-field";
import { SnapshotUploadForm } from "@/app/projects/_components/sprint-forms";
import { deleteSprint, undoBaseline } from "@/app/projects/sprint-actions";
import { ChangeTable } from "@/components/change-table";
import { ConfirmButton } from "@/components/confirm-button";
import { RemoveSection } from "@/components/remove-section";
import { SectionHeader } from "@/components/section-header";
import { SprintMetricsPanel } from "@/components/sprint-metrics";
import { formatDay, toDay } from "@/lib/sprint/dates";
import { db } from "@/lib/server/db";
import { requireSprint } from "@/lib/server/dal";
import { settingsOf, toStory } from "@/lib/server/readiness";
import { doneStatusesOf, loadProjectTrends, loadSprint } from "@/lib/server/sprint";
import { daysBetween, utcToday } from "@/lib/sprint/tracking";
import { averageVelocity } from "@/lib/sprint/trends";
import { normalizeKey } from "@/lib/stories/types";

export const metadata: Metadata = { title: "Sprint" };

export default async function SprintPage({ params }: PageProps<"/projects/[projectId]/sprints/[sprintId]">) {
  const { projectId, sprintId } = await params;
  const { project, sprint } = await requireSprint(projectId, sprintId);

  const { snapshots, baselineRow: baseline, latestRow: latest, metrics, log } = await loadSprint(sprint, doneStatusesOf(project));
  const total = (items: { storyPoints: number | null }[]) => items.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  const dayRange = `${formatDay(sprint.startDate)} to ${formatDay(sprint.endDate)}`;
  const backlog = (await db.story.findMany({ where: { projectId: project.id }, orderBy: [{ rank: "asc" }, { key: "asc" }] })).map((row) => ({
    id: row.id,
    ...toStory(row),
  }));
  const settings = settingsOf(project);
  const today = utcToday();
  // A day's leeway at each end, because "today" here is the UTC day and the user may be ahead or behind it.
  const running = daysBetween(today, sprint.startDate) <= 1 && daysBetween(sprint.endDate, today) <= 1;
  // The sprint's stories now: the latest snapshot's keys, matched to the backlog for editing.
  const byKey = new Map(backlog.map((s) => [normalizeKey(s.key), s]));
  const inSprint = latest?.items.map((item) => ({ item, story: byKey.get(normalizeKey(item.key)) })) ?? [];
  const staleDays = latest && !sprint.tracksBacklog && running ? daysBetween(latest.asOfDate, today) : 0;
  const capacity = baseline ? null : averageVelocity(await loadProjectTrends(project, sprint.id));
  const uploadProps = {
    backlog,
    settings,
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
          baseline && (
            <>
              {/* Right after locking is when a wrong tick is noticed, so the undo sits at the top. */}
              {snapshots.length === 1 && (
                <ConfirmButton
                  tone="quiet"
                  label="Undo baseline"
                  title="Undo this baseline?"
                  body="The sprint goes back to step 1 so you can pick the committed stories again. Nothing has been measured against it yet, and backlog stories are untouched."
                  confirmLabel="Undo baseline"
                  action={undoBaseline.bind(null, project.id, sprint.id)}
                />
              )}
              <Link href={`/projects/${project.id}/sprints/${sprint.id}/report`} className="btn-primary">
                <FileText aria-hidden="true" className="h-4 w-4" />
                Open sprint report
              </Link>
            </>
          )
        }
      />

      <SprintGoalForm projectId={project.id} sprintId={sprint.id} goal={sprint.goal} outcome={sprint.goalOutcome} />

      {!baseline ? (
        <section aria-labelledby="baseline-heading" className="space-y-3">
          <h2 id="baseline-heading" className="font-semibold">
            Step 1: lock the baseline
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            Choose the stories the team committed to on day one, from the backlog or a CSV. Every later snapshot is
            compared against this baseline, so it can&apos;t be edited. If you lock the wrong stories, you can undo it
            until you save the first later snapshot.
          </p>
          <SnapshotUploadForm mode="baseline" {...uploadProps} capacity={capacity} minDay={toDay(sprint.startDate)} />
        </section>
      ) : (
        <>
          {staleDays >= 3 && (
            <p role="status" className="rounded-lg bg-needs-work-bg px-4 py-3 text-sm text-needs-work">
              The last snapshot is from {formatDay(latest!.asOfDate)}, {staleDays} days ago. Save a fresh one below so the
              metrics and report show where the sprint is now.
            </p>
          )}

          {metrics && <SprintMetricsPanel metrics={metrics} />}

          {sprint.tracksBacklog && (
            <section aria-labelledby="in-sprint-heading" className="space-y-3">
              <div>
                <h2 id="in-sprint-heading" className="font-semibold">
                  In this sprint
                </h2>
                <p className="mt-0.5 max-w-2xl text-sm text-muted">
                  {running
                    ? "Change a status or estimate here or in the backlog, and it's recorded in today's snapshot. No need to save one."
                    : "Changes were recorded automatically while the sprint ran."}
                </p>
              </div>
              <StatusOptions id="sprint-status-options" doneStatuses={doneStatusesOf(project)} />
              <div className="card overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Stories in the sprint now</caption>
                  <thead>
                    <tr>
                      <th scope="col">Story</th>
                      <th scope="col" className="sm:w-40">Status</th>
                      <th scope="col" className="hidden sm:table-cell sm:w-24">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inSprint.map(({ item, story }) => (
                      <tr key={item.key}>
                        <td>
                          <span className="font-mono text-xs text-subtle">{item.key}</span>{" "}
                          {story ? (
                            <Link href={`/projects/${project.id}/stories/${story.id}`} className="font-medium hover:text-accent hover:underline">
                              {story.title}
                            </Link>
                          ) : (
                            <span className="font-medium">
                              {item.title} <span className="text-xs font-normal text-subtle">(deleted from the backlog)</span>
                            </span>
                          )}
                        </td>
                        {story && running ? (
                          <>
                            <td>
                              <QuickField
                                projectId={project.id}
                                storyId={story.id}
                                storyKey={story.key}
                                field="status"
                                value={story.status}
                                listId="sprint-status-options"
                              />
                            </td>
                            <td className="hidden sm:table-cell">
                              <QuickField
                                projectId={project.id}
                                storyId={story.id}
                                storyKey={story.key}
                                field="storyPoints"
                                value={story.storyPoints === null ? "" : String(story.storyPoints)}
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="text-muted">{item.status || "—"}</td>
                            <td className="hidden tabular-nums text-muted sm:table-cell">{item.storyPoints ?? "—"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section aria-labelledby="upload-heading" className="space-y-3">
            <h2 id="upload-heading" className="font-semibold">
              {sprint.tracksBacklog ? "Add or remove stories" : "Save a later snapshot"}
            </h2>
            <p className="max-w-2xl text-sm text-muted">
              {sprint.tracksBacklog
                ? "When work joins or leaves the sprint, tick the stories in it now and save. Status and points changes don't need this; they're recorded as you make them."
                : "As the sprint runs, record where it stands: pick the stories from the backlog, or upload a fresh export. You'll see what changed before saving. Stories are matched by key, so a renamed story isn't counted as removed and added."}
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
              <ChangeTable
                caption="Every change since the baseline, newest first"
                rows={log}
                reasons={(row) =>
                  row.id && (
                    <ReasonSelect
                      projectId={project.id}
                      sprintId={sprint.id}
                      changeId={row.id}
                      storyKey={row.key}
                      reason={row.reason ?? null}
                    />
                  )
                }
              />
            )}
            <p className="text-xs text-muted">
              Tag why each scope change happened; the report adds them up. Snapshots show between which two snapshots
              a change happened, not who made it.
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
                  {s.auto && <span className="text-xs text-subtle">Recorded automatically</span>}
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

      <RemoveSection title="Delete this sprint" action={deleteButton}>
        Removes the baseline, snapshots and change log. Backlog stories are untouched.
      </RemoveSection>
    </div>
  );
}
