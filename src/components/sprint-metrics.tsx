import { explainMetrics, formatPercent, formatPoints, reestimateNote, unestimatedNote, type SprintMetrics } from "@/lib/sprint/metrics";

/**
 * The sums behind Net change, Churn and Completion, so nobody has to work out why 3 added and 5 removed make +18.8%.
 * Compact (the printed report) drops the heading and the churn line: the report has to stay one A4 page.
 */
export function MetricsArithmetic({ metrics, compact = false }: { metrics: SprintMetrics; compact?: boolean }) {
  const lines = explainMetrics(metrics);
  if (!lines) return null;
  return (
    <div className={compact ? "text-xs leading-tight text-muted" : "text-xs text-muted"}>
      {!compact && <p className="font-medium">How these add up</p>}
      <ul className={compact ? "space-y-0.5" : "mt-1 space-y-1"}>
        <li>{lines.net}</li>
        {!compact && <li>{lines.churn}</li>}
        <li>{lines.completion}</li>
      </ul>
    </div>
  );
}

/** S-4: the five metrics from the requirements doc, plus the two totals they are based on. */
export function SprintMetricsPanel({ metrics }: { metrics: SprintMetrics }) {
  const tiles = [
    {
      label: "Scope added",
      value: formatPoints(metrics.scopeAdded),
      // Bugs often arrive without points; counting them keeps a flood of them from reading as "0 pts".
      note: metrics.addedUnestimated > 0 ? `New work, ${unestimatedNote(metrics.addedUnestimated)}` : "New work since the baseline",
    },
    { label: "Scope removed", value: formatPoints(metrics.scopeRemoved), note: "Baseline work taken out" },
    {
      label: "Net change",
      value: formatPercent(metrics.netChange, { signed: true }),
      note: reestimateNote(metrics) || "Did the sprint grow or shrink",
    },
    { label: "Churn", value: formatPercent(metrics.churn), note: "Instability, even when net is zero" },
    { label: "Completion", value: formatPercent(metrics.completion), note: "Of the original commitment, done" },
  ];
  return (
    <section aria-labelledby="metrics-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="metrics-heading" className="font-semibold">
          Sprint metrics
        </h2>
        <p className="text-sm text-muted">
          Baseline {metrics.baselineTotal} points · latest snapshot {metrics.latestTotal} points ·{" "}
          <a href="/guide#numbers-heading" className="no-print text-accent underline underline-offset-2">
            What these mean
          </a>
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="card p-4">
            <dt className="text-xs font-medium text-muted">{tile.label}</dt>
            <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{tile.value}</dd>
            <dd className="mt-1 text-xs text-subtle">{tile.note}</dd>
          </div>
        ))}
      </dl>
      <MetricsArithmetic metrics={metrics} />
      {metrics.baselineTotal === 0 && (
        <p className="text-sm text-needs-work">The baseline has 0 points, so percentages can&apos;t be calculated.</p>
      )}
      {metrics.unestimatedKeys.length > 0 && (
        <p className="rounded-lg bg-needs-work-bg px-3 py-2 text-sm text-needs-work">
          {metrics.unestimatedKeys.length} {metrics.unestimatedKeys.length === 1 ? "story has" : "stories have"} no
          points and {metrics.unestimatedKeys.length === 1 ? "counts" : "count"} as 0:{" "}
          {metrics.unestimatedKeys.join(", ")}.
        </p>
      )}
    </section>
  );
}
