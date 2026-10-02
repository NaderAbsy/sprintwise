import { Check, X } from "lucide-react";
import { BandBadge } from "@/components/band-badge";
import { ScoreRing } from "@/components/score-ring";
import type { Readiness } from "@/lib/readiness/rules";

/** Score, band and every rule: what failed and why first, then the checks that passed. */
export function ReadinessBreakdown({ readiness }: { readiness: Readiness }) {
  const failed = readiness.rules.filter((r) => !r.passed);
  const passed = readiness.rules.filter((r) => r.passed);
  return (
    <section aria-label="Readiness score" className="card p-5">
      <div className="flex items-center gap-4">
        <ScoreRing score={readiness.score} band={readiness.band} size="lg" />
        <div className="space-y-1.5">
          <p className="eyebrow">Readiness</p>
          <BandBadge band={readiness.band} />
          <p className="text-sm text-muted">
            {failed.length === 0
              ? "Every check passed."
              : `${failed.length} ${failed.length === 1 ? "check" : "checks"} failed`}
          </p>
        </div>
      </div>
      {readiness.bandCap && (
        <p className="mt-4 rounded-lg bg-needs-work-bg px-3 py-2 text-sm text-needs-work">
          {readiness.score} would be Ready, but this story is capped at Needs work. {readiness.bandCap}
        </p>
      )}
      {failed.length > 0 && (
        <ul className="mt-5 space-y-3 border-t border-border pt-4">
          {failed.map((rule) => (
            <li key={rule.id} className="flex gap-3 text-sm">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-not-ready-bg text-not-ready">
                <X aria-hidden="true" className="h-3 w-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{rule.check}.</span> <span className="text-muted">{rule.reason}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-not-ready tabular-nums">−{rule.points}</span>
            </li>
          ))}
        </ul>
      )}
      {passed.length > 0 && (
        <details className="mt-4 border-t border-border pt-3 text-sm">
          <summary className="cursor-pointer text-muted hover:text-foreground">
            {passed.length} {passed.length === 1 ? "check" : "checks"} passed
          </summary>
          <ul className="mt-2 space-y-1.5">
            {passed.map((rule) => (
              <li key={rule.id} className="flex items-center gap-3">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ready-bg text-ready">
                  <Check aria-hidden="true" className="h-3 w-3" />
                </span>
                <span className="flex-1 text-muted">{rule.check}</span>
                <span className="font-mono text-xs text-subtle tabular-nums">+{rule.points}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
