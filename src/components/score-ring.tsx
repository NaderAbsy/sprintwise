import { bandStroke } from "@/components/band-badge";
import type { Band } from "@/lib/readiness/rules";

const SIZES = { sm: { box: 36, stroke: 3.5, text: "text-[11px]" }, md: { box: 64, stroke: 5, text: "text-lg" }, lg: { box: 96, stroke: 7, text: "text-3xl" } };

/** The readiness score as a ring, coloured by band. The number stays readable text for screen readers. */
export function ScoreRing({ score, band, size = "md" }: { score: number; band: Band; size?: keyof typeof SIZES }) {
  const { box, stroke, text } = SIZES[size];
  const r = (box - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: box, height: box }}>
      <svg viewBox={`0 0 ${box} ${box}`} aria-hidden="true" className="absolute inset-0 -rotate-90">
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-2" />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(Math.max(0, Math.min(100, score)) / 100) * circumference} ${circumference}`}
          className={bandStroke[band]}
        />
      </svg>
      <span className={`relative font-semibold tabular-nums ${text}`}>
        {score}
        <span className="sr-only"> out of 100</span>
      </span>
    </span>
  );
}
