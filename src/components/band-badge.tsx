import type { Band } from "@/lib/readiness/rules";

const styles: Record<Band, { pill: string; dot: string }> = {
  Ready: { pill: "bg-ready-bg text-ready", dot: "bg-ready-dot" },
  "Needs work": { pill: "bg-needs-work-bg text-needs-work", dot: "bg-needs-work-dot" },
  "Not ready": { pill: "bg-not-ready-bg text-not-ready", dot: "bg-not-ready-dot" },
};

export function BandBadge({ band }: { band: Band }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${styles[band].pill}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${styles[band].dot}`} />
      {band}
    </span>
  );
}

export const bandStroke: Record<Band, string> = {
  Ready: "stroke-ready-dot",
  "Needs work": "stroke-needs-work-dot",
  "Not ready": "stroke-not-ready-dot",
};
