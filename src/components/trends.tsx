import { Lightbulb } from "lucide-react";
import { formatPercent, formatPoints } from "@/lib/sprint/metrics";
import type { SprintTrendRow, TrendSummary } from "@/lib/sprint/trends";

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

/** Velocity, completion, churn and readiness across sprints. Used by projects and the demo. */
export function Trends({ rows, summary }: { rows: SprintTrendRow[]; summary: TrendSummary }) {
  const measured = rows.filter((r) => r.measured);
  const cards = [
    { label: "Velocity", value: summary.velocity ? formatPoints(summary.velocity.points) : "—", note: "Points done per sprint, last 3" },
    { label: "Completion", value: pct(summary.completion), note: "Of the commitment, last 3" },
    { label: "Churn", value: pct(summary.churn), note: "Lower is steadier, last 3" },
    { label: "Ready at planning", value: pct(summary.readyAtBaseline), note: "Stories Ready when committed" },
  ];
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <dt className="text-xs font-medium text-muted">{c.label}</dt>
            <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{c.value}</dd>
            <dd className="mt-1 text-xs text-subtle">{c.note}</dd>
          </div>
        ))}
      </dl>

      {summary.insights.length > 0 && (
        <section aria-label="What the trends say" className="card space-y-2 p-4">
          {summary.insights.map((text) => (
            <p key={text} className="flex gap-2 text-sm">
              <Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {text}
            </p>
          ))}
          {summary.basis === "previous" && (
            <p className="pl-6 text-xs text-muted">
              This compares only the last two sprints, so treat it as a hint. From four sprints, Sprintwise compares
              averages instead.
            </p>
          )}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Committed vs done" legend={[["bg-border-strong", "Committed"], ["bg-accent", "Done"]]}>
          <BarChart rows={measured} />
        </ChartCard>
        <ChartCard
          title="Completion, churn and readiness"
          legend={[["bg-accent", "Completion"], ["bg-amber-500", "Churn"], ["bg-emerald-500", "Ready at planning"]]}
        >
          <LineChart rows={measured} />
        </ChartCard>
      </div>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Show the numbers as a table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Sprint trends, oldest first</caption>
            <thead>
              <tr>
                <th scope="col">Sprint</th>
                <th scope="col" className="text-right">Committed</th>
                <th scope="col" className="text-right">Done</th>
                <th scope="col" className="text-right">Completion</th>
                <th scope="col" className="text-right">Churn</th>
                <th scope="col" className="text-right">Net change</th>
                <th scope="col" className="text-right">Ready at planning</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">
                    {r.name}
                    {!r.measured && <span className="ml-2 text-xs text-subtle">baseline only</span>}
                  </td>
                  <td className="text-right tabular-nums">{r.committed}</td>
                  <td className="text-right tabular-nums">{r.measured ? r.done : "—"}</td>
                  <td className="text-right tabular-nums">{r.measured ? formatPercent(r.completion) : "—"}</td>
                  <td className="text-right tabular-nums">{r.measured ? formatPercent(r.churn) : "—"}</td>
                  <td className="text-right tabular-nums">{r.measured ? formatPercent(r.netChange, { signed: true }) : "—"}</td>
                  <td className="text-right tabular-nums">{pct(r.readyAtBaseline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function ChartCard({ title, legend, children }: { title: string; legend: [string, string][]; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <ul className="flex flex-wrap gap-3 text-xs text-muted">
          {legend.map(([color, label]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${color}`} />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const H = 180;
const PAD = { top: 10, right: 8, bottom: 28, left: 34 };
const short = (name: string) => (name.length > 10 ? `${name.slice(0, 9)}…` : name);

/** Grouped bars: what the team committed to and what it finished, per sprint. */
function BarChart({ rows }: { rows: SprintTrendRow[] }) {
  const W = Math.max(320, rows.length * 64 + PAD.left + PAD.right);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.committed, r.done)));
  const step = (W - PAD.left - PAD.right) / Math.max(rows.length, 1);
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart of committed and done points per sprint" className="w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="3 3" />
          <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-subtle text-[10px]">
            {t}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const x = PAD.left + i * step + step / 2;
        const bw = Math.min(18, step / 3);
        return (
          <g key={r.id}>
            <rect x={x - bw - 1} y={y(r.committed)} width={bw} height={y(0) - y(r.committed)} rx={3} className="fill-border-strong">
              <title>{`${r.name}: committed ${formatPoints(r.committed)}`}</title>
            </rect>
            <rect x={x + 1} y={y(r.done)} width={bw} height={y(0) - y(r.done)} rx={3} className="fill-accent">
              <title>{`${r.name}: done ${formatPoints(r.done)}`}</title>
            </rect>
            <text x={x} y={H - 10} textAnchor="middle" className="fill-muted text-[10px]">
              {short(r.name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Three percentages over time on one 0–100% scale. */
function LineChart({ rows }: { rows: SprintTrendRow[] }) {
  const W = Math.max(320, rows.length * 64 + PAD.left + PAD.right);
  const step = (W - PAD.left - PAD.right) / Math.max(rows.length, 1);
  const x = (i: number) => PAD.left + i * step + step / 2;
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - Math.min(1, Math.max(0, v)));
  const series: { key: string; label: string; className: string; pick: (r: SprintTrendRow) => number | null }[] = [
    { key: "completion", label: "Completion", className: "stroke-accent fill-accent", pick: (r) => r.completion },
    { key: "churn", label: "Churn", className: "stroke-amber-500 fill-amber-500", pick: (r) => r.churn },
    { key: "ready", label: "Ready at planning", className: "stroke-emerald-500 fill-emerald-500", pick: (r) => r.readyAtBaseline },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart of completion, churn and readiness per sprint" className="w-full">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="3 3" />
          <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-subtle text-[10px]">
            {t * 100}%
          </text>
        </g>
      ))}
      {series.map((s) => {
        const points = rows
          .map((r, i) => ({ px: x(i), v: s.pick(r), name: r.name }))
          .filter((p): p is { px: number; v: number; name: string } => p.v !== null);
        return (
          <g key={s.key} className={s.className}>
            <polyline
              points={points.map((p) => `${p.px},${y(p.v)}`).join(" ")}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={s.className.split(" ")[0]}
            />
            {points.map((p) => (
              <circle key={p.px} cx={p.px} cy={y(p.v)} r={3.5} className={s.className.split(" ")[1]}>
                <title>{`${p.name}: ${s.label} ${Math.round(p.v * 100)}%`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {rows.map((r, i) => (
        <text key={r.id} x={x(i)} y={H - 10} textAnchor="middle" className="fill-muted text-[10px]">
          {short(r.name)}
        </text>
      ))}
    </svg>
  );
}
