import type { Metadata } from "next";
import Link from "next/link";
import { ChangeTable } from "@/components/change-table";
import { PrintButton } from "@/components/print-button";
import { formatDay } from "@/lib/sprint/dates";
import { formatPercent, type SprintMetrics } from "@/lib/sprint/metrics";
import { compareReadiness, isScopeChange, readinessFinding } from "@/lib/sprint/report";
import { requireSprint } from "@/lib/server/dal";
import { settingsOf } from "@/lib/server/readiness";
import { loadSprint } from "@/lib/server/sprint";
import { recordUsage } from "@/lib/server/usage";

export const metadata: Metadata = { title: "Sprint report" };

/** Rows that still fit one A4 page alongside the metrics; the sprint page has the full log. */
const MAX_LOG_ROWS = 18;

function headline(m: SprintMetrics): string {
  if (m.netChange === null || m.churn === null || m.completion === null) {
    return "The baseline has 0 points, so scope change can't be measured.";
  }
  const net =
    m.netChange === 0
      ? "Scope held at the committed size"
      : `Scope ${m.netChange > 0 ? "grew" : "shrank"} ${formatPercent(Math.abs(m.netChange))}`;
  return `${net}, churn was ${formatPercent(m.churn)}, and ${formatPercent(m.completion)} of the original commitment was done.`;
}

const score = (value: number | null) => (value === null ? "—" : String(Math.round(value)));

export default async function SprintReportPage({ params }: PageProps<"/projects/[projectId]/sprints/[sprintId]/report">) {
  const { projectId, sprintId } = await params;
  const { project, sprint } = await requireSprint(projectId, sprintId);
  const { baseline, latest, latestRow, metrics, log } = await loadSprint(sprint);
  const back = `/projects/${project.id}/sprints/${sprint.id}`;

  if (!baseline || !latest || !metrics) {
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
  const readiness = compareReadiness(baseline, latest, settingsOf(project));
  const scopeLog = log.filter(isScopeChange);
  const statusChanges = log.filter((c) => c.type === "status-changed").length;
  const renames = log.filter((c) => c.type === "renamed").length;
  const notListed = [
    statusChanges > 0 && `${statusChanges} status ${statusChanges === 1 ? "change" : "changes"}`,
    renames > 0 && `${renames} ${renames === 1 ? "rename" : "renames"}`,
  ].filter(Boolean);
  const tiles = [
    { label: "Scope added", value: `${metrics.scopeAdded} pts` },
    { label: "Scope removed", value: `${metrics.scopeRemoved} pts` },
    { label: "Net change", value: formatPercent(metrics.netChange, { signed: true }) },
    { label: "Churn", value: formatPercent(metrics.churn) },
    { label: "Completion", value: formatPercent(metrics.completion) },
  ];

  return (
    <article className="report mx-auto max-w-3xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={back} className="text-sm text-muted hover:underline">
          ← Back to {sprint.name}
        </Link>
        <PrintButton />
      </div>

      <header className="border-b border-border pb-4">
        <p className="text-sm text-muted">{project.name} · Sprint report</p>
        <h1 className="text-2xl font-semibold">{sprint.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {formatDay(sprint.startDate)} to {formatDay(sprint.endDate)} · baseline {metrics.baselineTotal} pts, latest
          snapshot ({formatDay(latestRow!.asOfDate)}) {metrics.latestTotal} pts
        </p>
        <p className="mt-3 text-lg font-medium">{headline(metrics)}</p>
      </header>

      <section aria-labelledby="report-metrics">
        <h2 id="report-metrics" className="sr-only">
          Metrics
        </h2>
        <dl className="grid grid-cols-5 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="card px-3 py-2">
              <dt className="text-xs text-muted">{t.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>
        {metrics.unestimatedKeys.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Counted as 0 points because they have no estimate: {metrics.unestimatedKeys.join(", ")}.
          </p>
        )}
      </section>

      <section aria-labelledby="report-readiness" className="space-y-2">
        <h2 id="report-readiness" className="font-semibold">
          Readiness at the baseline
        </h2>
        <p className="text-sm">{readinessFinding(readiness)}</p>
        <dl className="grid max-w-md grid-cols-2 gap-2">
          <div className="card px-3 py-2">
            <dt className="text-xs text-muted">Changed scope ({readiness.changed.count})</dt>
            <dd className="text-xl font-semibold tabular-nums">{score(readiness.changed.averageScore)}</dd>
          </div>
          <div className="card px-3 py-2">
            <dt className="text-xs text-muted">Unchanged ({readiness.unchanged.count})</dt>
            <dd className="text-xl font-semibold tabular-nums">{score(readiness.unchanged.averageScore)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted">
          Average readiness score out of 100. A story changed scope if it was removed, re-estimated or had its criteria
          edited.
        </p>
      </section>

      <section aria-labelledby="report-log" className="space-y-2">
        <h2 id="report-log" className="font-semibold">
          Scope changes
        </h2>
        {scopeLog.length === 0 ? (
          <p className="text-sm text-muted">No scope changes since the baseline.</p>
        ) : (
          <ChangeTable caption="Scope changes, newest first" rows={scopeLog.slice(0, MAX_LOG_ROWS)} />
        )}
        <p className="text-xs text-muted">
          {scopeLog.length > MAX_LOG_ROWS && `Showing the ${MAX_LOG_ROWS} most recent of ${scopeLog.length}; the sprint page has the full log. `}
          {notListed.length > 0 && `Not listed because they don't change scope: ${notListed.join(" and ")}. `}
          CSV snapshots show when a change appeared, not who made it.
        </p>
      </section>

      <footer className="border-t border-border pt-3 text-xs text-muted">
        Generated by Sprintwise on {formatDay(new Date())}. Stories are matched by key across snapshots.
      </footer>
    </article>
  );
}
