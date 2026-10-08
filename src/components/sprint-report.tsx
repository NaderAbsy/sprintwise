import Link from "next/link";
import { BurnupChart } from "@/components/burnup-chart";
import { ChangeTable } from "@/components/change-table";
import { PrintButton } from "@/components/print-button";
import type { RuleSettings } from "@/lib/readiness/rules";
import { burnupSeries } from "@/lib/sprint/burnup";
import { formatDay } from "@/lib/sprint/dates";
import { computeMetrics, formatPercent, formatPoints, unestimatedNote, type SprintMetrics } from "@/lib/sprint/metrics";
import { compareReadiness, isScopeChange, readinessFinding, type LogRow } from "@/lib/sprint/report";
import { GOAL_OUTCOMES, reasonFinding, summarizeReasons } from "@/lib/sprint/reasons";
import type { Story } from "@/lib/stories/types";

/** Rows that still fit one A4 page alongside the metrics and the chart; the sprint page has the full log. */
const MAX_LOG_ROWS = 10;

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

export type SprintReportProps = {
  projectName: string;
  sprint: { name: string; startDate: Date; endDate: Date; goal?: string; goalOutcome?: string | null };
  baseline: Story[];
  latest: Story[];
  latestAsOf: Date;
  log: LogRow[];
  settings: RuleSettings;
  /** The project's Done statuses; the defaults when absent. */
  doneStatuses?: readonly string[];
  /** Every snapshot in date order, for the burn-up. Without them the chart is left out. */
  snapshots?: { asOfDate: Date; items: Story[] }[];
  /** Absent on a shared, read-only report. */
  back?: { href: string; label: string };
  /** Extra controls for the owner, such as sharing. */
  actions?: React.ReactNode;
};

const REASON_COLORS = ["bg-accent", "bg-fuchsia-500", "bg-sky-500", "bg-amber-500", "bg-emerald-500"];

/** S-5: one printable A4 page. Used by real sprints and by the demo. */
export function SprintReport({
  projectName,
  sprint,
  baseline,
  latest,
  latestAsOf,
  log,
  settings,
  doneStatuses,
  snapshots,
  back,
  actions,
}: SprintReportProps) {
  const metrics = computeMetrics(baseline, latest, doneStatuses);
  const readiness = compareReadiness(baseline, latest, settings);
  const scopeLog = log.filter(isScopeChange);
  const reasons = summarizeReasons(scopeLog);
  const reasonSentence = reasonFinding(reasons);
  const tagged = reasons.rows.filter((r) => r.id !== null);
  const outcome = GOAL_OUTCOMES.find((o) => o.id === sprint.goalOutcome)?.label;
  const statusChanges = log.filter((c) => c.type === "status-changed").length;
  const renames = log.filter((c) => c.type === "renamed").length;
  const notListed = [
    statusChanges > 0 && `${statusChanges} status ${statusChanges === 1 ? "change" : "changes"}`,
    renames > 0 && `${renames} ${renames === 1 ? "rename" : "renames"}`,
  ].filter(Boolean);
  const tiles = [
    { label: "Scope added", value: formatPoints(metrics.scopeAdded), note: unestimatedNote(metrics.addedUnestimated) },
    { label: "Scope removed", value: formatPoints(metrics.scopeRemoved) },
    { label: "Net change", value: formatPercent(metrics.netChange, { signed: true }) },
    { label: "Churn", value: formatPercent(metrics.churn) },
    { label: "Completion", value: formatPercent(metrics.completion) },
  ];

  return (
    <article className="report mx-auto max-w-3xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        {back ? (
          <Link href={back.href} className="text-sm text-muted hover:underline">
            ← {back.label}
          </Link>
        ) : (
          <span className="text-sm text-muted">Shared read-only report</span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <PrintButton />
        </div>
      </div>

      <header className="border-b border-border pb-4">
        <p className="text-sm text-muted">{projectName} · Sprint report</p>
        <h1 className="text-2xl font-semibold">{sprint.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {formatDay(sprint.startDate)} to {formatDay(sprint.endDate)} · baseline {metrics.baselineTotal} pts, latest
          snapshot ({formatDay(latestAsOf)}) {metrics.latestTotal} pts
        </p>
        {sprint.goal && (
          <p className="mt-3 text-sm">
            <span className="font-medium">Goal:</span> {sprint.goal}
            {outcome && (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  sprint.goalOutcome === "met"
                    ? "bg-ready-bg text-ready"
                    : sprint.goalOutcome === "partly"
                      ? "bg-needs-work-bg text-needs-work"
                      : "bg-not-ready-bg text-not-ready"
                }`}
              >
                {outcome}
              </span>
            )}
          </p>
        )}
        <p className="mt-3 text-lg font-medium">{headline(metrics)}</p>
      </header>

      <section aria-labelledby="report-metrics">
        <h2 id="report-metrics" className="sr-only">
          Metrics
        </h2>
        {/* Five across on paper and wider screens; two rows on a phone, where five would squash the labels. */}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5 print:grid-cols-5">
          {tiles.map((t) => (
            <div key={t.label} className="card px-3 py-2">
              <dt className="text-xs text-muted">{t.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{t.value}</dd>
              {"note" in t && t.note && <dd className="text-xs text-needs-work">{t.note}</dd>}
            </div>
          ))}
        </dl>
        {metrics.unestimatedKeys.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Counted as 0 points because they have no estimate: {metrics.unestimatedKeys.join(", ")}.
          </p>
        )}
      </section>

      {snapshots && snapshots.length > 1 && (
        <section aria-labelledby="report-burnup">
          <h2 id="report-burnup" className="mb-2 font-semibold">
            Scope and work done
          </h2>
          <BurnupChart
            series={burnupSeries(snapshots, doneStatuses)}
            committed={metrics.baselineTotal}
            start={sprint.startDate}
            end={sprint.endDate}
            height={150}
          />
        </section>
      )}

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

      {tagged.length > 0 && (
        <section aria-labelledby="report-reasons" className="space-y-2">
          <h2 id="report-reasons" className="font-semibold">
            Why scope changed
          </h2>
          {reasonSentence && <p className="text-sm">{reasonSentence}</p>}
          <div aria-hidden="true" className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            {reasons.rows.map((r, i) => (
              <div
                key={r.label}
                className={r.id === null ? "bg-border-strong" : REASON_COLORS[i % REASON_COLORS.length]}
                style={{ width: `${r.share * 100}%` }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {reasons.rows.map((r, i) => (
              <li key={r.label} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${r.id === null ? "bg-border-strong" : REASON_COLORS[i % REASON_COLORS.length]}`}
                />
                {r.label}: {r.points} pts ({Math.round(r.share * 100)}%)
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="report-log" className="space-y-2">
        <h2 id="report-log" className="font-semibold">
          Scope changes
        </h2>
        {scopeLog.length === 0 ? (
          <p className="text-sm text-muted">No scope changes since the baseline.</p>
        ) : (
          <ChangeTable
            caption="Scope changes, newest first"
            rows={scopeLog.slice(0, MAX_LOG_ROWS)}
            reasons={tagged.length > 0 ? "text" : undefined}
          />
        )}
        <p className="text-xs text-muted">
          {scopeLog.length > MAX_LOG_ROWS &&
            `Showing the ${MAX_LOG_ROWS} most recent of ${scopeLog.length}; the sprint page has the full log. `}
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
