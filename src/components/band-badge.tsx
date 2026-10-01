import type { Band } from "@/lib/readiness/rules";

const styles: Record<Band, string> = {
  Ready: "bg-ready-bg text-ready",
  "Needs work": "bg-needs-work-bg text-needs-work",
  "Not ready": "bg-not-ready-bg text-not-ready",
};

export function BandBadge({ band }: { band: Band }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[band]}`}>
      {band}
    </span>
  );
}
