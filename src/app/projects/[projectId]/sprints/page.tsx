import { Plus, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { formatDay, toDay } from "@/lib/sprint/dates";
import { SprintDay } from "@/components/sprint-day";
import type { Story } from "@/lib/stories/types";
import { computeMetrics, formatPercent } from "@/lib/sprint/metrics";
import { db } from "@/lib/server/db";
import { requireProject } from "@/lib/server/dal";
import { doneStatusesOf } from "@/lib/server/sprint";

export const metadata: Metadata = { title: "Sprints" };

export default async function SprintsPage({ params }: PageProps<"/projects/[projectId]/sprints">) {
  const project = await requireProject((await params).projectId);
  const base = `/projects/${project.id}/sprints`;
  const sprints = await db.sprint.findMany({
    where: { projectId: project.id },
    orderBy: { startDate: "desc" },
    include: { snapshots: { orderBy: [{ asOfDate: "asc" }, { uploadedAt: "asc" }], select: { id: true, isBaseline: true } } },
  });
  // The metrics need only the baseline and latest snapshot, and only each story's key, points and status.
  const ids = sprints.flatMap((s) => {
    const baseline = s.snapshots.find((x) => x.isBaseline);
    return baseline ? [baseline.id, s.snapshots.at(-1)!.id] : [];
  });
  const items = await db.snapshotItem.findMany({
    where: { snapshotId: { in: [...new Set(ids)] } },
    select: { snapshotId: true, key: true, storyPoints: true, status: true },
  });
  const storiesOf = new Map<string, Story[]>();
  for (const { snapshotId, ...item } of items) {
    const list = storiesOf.get(snapshotId) ?? [];
    list.push({ ...item, title: "", description: "", acceptanceCriteria: "" });
    storiesOf.set(snapshotId, list);
  }

  const newSprint = (
    <Link href={`${base}/new`} className="btn-primary">
      <Plus aria-hidden="true" className="h-4 w-4" />
      New sprint
    </Link>
  );

  return (
    <>
      <SectionHeader
        title="Sprints"
        description="Lock the day-one sprint as a baseline, then save later snapshots to see how much it changed."
        actions={sprints.length > 0 ? newSprint : undefined}
      />
      {sprints.length === 0 ? (
        <EmptyState icon={Timer} title="No sprints yet." action={newSprint}>
          Create one to lock a baseline and track how much it changes.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sprints.map((sprint) => {
            const baseline = sprint.snapshots.find((s) => s.isBaseline);
            const latest = sprint.snapshots.at(-1);
            const m =
              baseline && latest
                ? computeMetrics(storiesOf.get(baseline.id) ?? [], storiesOf.get(latest.id) ?? [], doneStatusesOf(project))
                : null;
            return (
              <li key={sprint.id}>
                <Link
                  href={`${base}/${sprint.id}`}
                  className="card group flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:border-accent/50"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold group-hover:text-accent">
                      {sprint.name}
                      <SprintDay start={toDay(sprint.startDate)} end={toDay(sprint.endDate)} badge />
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {formatDay(sprint.startDate)} to {formatDay(sprint.endDate)} ·{" "}
                      {sprint.snapshots.length === 0
                        ? "No baseline yet"
                        : `${sprint.snapshots.length} ${sprint.snapshots.length === 1 ? "snapshot" : "snapshots"}`}
                    </p>
                  </div>
                  {m && (
                    <dl className="flex gap-6 text-sm">
                      {[
                        ["Net change", formatPercent(m.netChange, { signed: true })],
                        ["Churn", formatPercent(m.churn)],
                        ["Completion", formatPercent(m.completion)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-subtle">{label}</dt>
                          <dd className="font-semibold tabular-nums">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
