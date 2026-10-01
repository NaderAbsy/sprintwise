import { formatPercent, type SprintMetrics } from "@/lib/sprint/metrics";

/** S-4: the five metrics from the requirements doc, plus the two totals they are based on. */
export function SprintMetricsPanel({ metrics }: { metrics: SprintMetrics }) {
  const tiles = [
    { label: "Scope added", value: `${metrics.scopeAdded} pts`, note: "New work since the baseline" },
    { label: "Scope removed", value: `${metrics.scopeRemoved} pts`, note: "Baseline work taken out" },
    { label: "Net change", value: formatPercent(metrics.netChange, { signed: true }), note: "Did the sprint grow or shrink" },
    { label: "Churn", value: formatPercent(metrics.churn), note: "Instability, even when net is zero" },
    { label: "Completion", value: formatPercent(metrics.completion), note: "Of the original commitment, done" },
  ];
  return (
    <section aria-labelledby="metrics-heading" className="space-y-3">
      <h2 id="metrics-heading" className="text-lg font-semibold">
        Sprint metrics
      </h2>
      <p className="text-sm text-muted">
        Baseline {metrics.baselineTotal} points · latest snapshot {metrics.latestTotal} points
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="card p-4">
            <dt className="text-sm text-muted">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</dd>
            <dd className="mt-1 text-xs text-muted">{tile.note}</dd>
          </div>
        ))}
      </dl>
      {metrics.baselineTotal === 0 && (
        <p className="text-sm text-needs-work">The baseline has 0 points, so percentages can&apos;t be calculated.</p>
      )}
      {metrics.unestimatedKeys.length > 0 && (
        <p className="rounded-md bg-needs-work-bg px-3 py-2 text-sm text-needs-work">
          {metrics.unestimatedKeys.length} {metrics.unestimatedKeys.length === 1 ? "story has" : "stories have"} no
          points and {metrics.unestimatedKeys.length === 1 ? "counts" : "count"} as 0:{" "}
          {metrics.unestimatedKeys.join(", ")}.
        </p>
      )}
    </section>
  );
}
