import { burnupSummary, type BurnupPoint } from "@/lib/sprint/burnup";
import { formatDay } from "@/lib/sprint/dates";

const W = 600;
const PAD = { top: 12, right: 12, bottom: 26, left: 36 };

/**
 * Burn-up for one sprint: total scope and work done on each snapshot day,
 * against the day-one commitment, across the sprint's dates. Lines hold their
 * value until the next snapshot, because that's all that's known.
 */
export function BurnupChart({
  series,
  committed,
  start,
  end,
  today,
  height = 200,
}: {
  series: BurnupPoint[];
  committed: number;
  start: Date;
  end: Date;
  /** While the sprint runs: the lines carry their last value to today, which is marked. */
  today?: Date;
  height?: number;
}) {
  const H = height;
  const max = Math.max(1, committed, ...series.map((p) => p.scope));
  const span = Math.max(1, end.getTime() - start.getTime());
  const x = (d: Date) => PAD.left + ((W - PAD.left - PAD.right) * (d.getTime() - start.getTime())) / span;
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / max);
  const last = series.at(-1);
  const now = today && last && today > last.date && today <= end ? today : null;
  // Step lines: flat until the next snapshot, then a jump; flat on to today while the sprint runs.
  const steps = (pick: (p: BurnupPoint) => number) =>
    [
      ...series.flatMap((p, i) =>
        i === 0 ? [[x(p.date), y(pick(p))]] : [[x(p.date), y(pick(series[i - 1]))], [x(p.date), y(pick(p))]],
      ),
      ...(now && last ? [[x(now), y(pick(last))]] : []),
    ]
      .map(([px, py]) => `${px},${py}`)
      .join(" ");
  const summary = burnupSummary(series, committed);

  return (
    <figure className="space-y-2">
      <ul className="flex flex-wrap gap-3 text-xs text-muted" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-sky-500" />
          Scope
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-accent" />
          Done
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-border-strong" />
          Committed on day one
        </li>
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Burn-up chart. ${summary}`} className="w-full">
        {[0, Math.round(max / 2), max].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-subtle text-[10px]">
              {t}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(committed)}
          y2={y(committed)}
          strokeWidth={2}
          strokeDasharray="6 4"
          className="stroke-border-strong"
        />
        {now && (
          <g>
            <line x1={x(now)} x2={x(now)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-subtle" strokeDasharray="2 3" />
            <text x={x(now)} y={PAD.top + 8} textAnchor="middle" className="fill-subtle text-[10px]">
              Today
            </text>
          </g>
        )}
        <polyline points={steps((p) => p.scope)} fill="none" strokeWidth={2.5} strokeLinejoin="round" className="stroke-sky-500" />
        <polyline points={steps((p) => p.done)} fill="none" strokeWidth={2.5} strokeLinejoin="round" className="stroke-accent" />
        {series.map((p) => (
          <g key={p.date.getTime()}>
            <circle cx={x(p.date)} cy={y(p.scope)} r={3.5} className="fill-sky-500">
              <title>{`${formatDay(p.date)}: scope ${p.scope} points`}</title>
            </circle>
            <circle cx={x(p.date)} cy={y(p.done)} r={3.5} className="fill-accent">
              <title>{`${formatDay(p.date)}: ${p.done} points done`}</title>
            </circle>
          </g>
        ))}
        <text x={PAD.left} y={H - 8} className="fill-muted text-[10px]">
          {formatDay(start)}
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-muted text-[10px]">
          {formatDay(end)}
        </text>
      </svg>
      <figcaption className="text-sm text-muted">{summary}</figcaption>
    </figure>
  );
}
