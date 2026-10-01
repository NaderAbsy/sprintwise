import { BandBadge } from "@/components/band-badge";
import type { Readiness } from "@/lib/readiness/rules";

/** Score, band and every rule, with a reason for each point lost. */
export function ReadinessBreakdown({ readiness }: { readiness: Readiness }) {
  const failed = readiness.rules.filter((r) => !r.passed);
  return (
    <section aria-label="Readiness score" className="card p-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-4xl font-semibold tabular-nums">
          {readiness.score}
          <span className="text-lg font-normal text-muted"> / 100</span>
        </p>
        <BandBadge band={readiness.band} />
      </div>
      {failed.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Every check passed.</p>
      ) : (
        <>
          <h3 className="mt-5 text-sm font-semibold">
            {failed.length} {failed.length === 1 ? "check" : "checks"} failed
          </h3>
          <ul className="mt-2 space-y-2">
            {failed.map((rule) => (
              <li key={rule.id} className="flex gap-3 text-sm">
                <span className="w-14 shrink-0 font-mono text-not-ready">−{rule.points}</span>
                <span>
                  <span className="font-medium">{rule.check}.</span> {rule.reason}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted">All {readiness.rules.length} checks</summary>
        <ul className="mt-2 space-y-1">
          {readiness.rules.map((rule) => (
            <li key={rule.id} className="flex gap-3">
              <span className="w-8 font-mono text-muted">{rule.id}</span>
              <span className="flex-1">{rule.check}</span>
              <span className="tabular-nums">
                {rule.earned} / {rule.points}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
