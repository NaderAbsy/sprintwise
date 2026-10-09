import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/server/dal";
import { loadInsights } from "@/lib/server/insights";
import { isSiteOwner } from "@/lib/server/site-owner";

export const metadata: Metadata = { title: "Insights" };

const percent = (value: number | null) => (value === null ? "" : `${Math.round(value * 100)}%`);
const week = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** For the people who run Sprintwise only: where new users get to, as totals. Everyone else gets a 404. */
export default async function InsightsPage() {
  const user = await requireUser();
  if (!(await isSiteOwner(user))) notFound();
  const { steps, signals, weeks, months } = await loadInsights(user.id);
  const top = Math.max(steps[0].count, 1);
  const busiestWeek = Math.max(...weeks.map((w) => w.count), 1);

  return (
    <>
      <PageHeader
        title="Insights"
        description="Where new users get to, counted from what Sprintwise already stores. Totals only, never who; your own account is left out."
      />
      <div className="max-w-3xl space-y-6">
        <section aria-labelledby="funnel-heading" className="card p-5">
          <h2 id="funnel-heading" className="font-semibold">
            From sign-up to a tracked sprint
          </h2>
          <p className="mt-1 text-sm text-muted">Each step counts accounts that got that far. The percentage is of the step before.</p>
          <ol className="mt-4 space-y-4">
            {steps.map((step) => (
              <li key={step.label}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                  <span>
                    <span className="font-medium">{step.label}</span> <span className="text-muted">· {step.hint}</span>
                  </span>
                  <span className="tabular-nums">
                    <strong>{step.count}</strong>
                    {step.ofPrevious !== null && <span className="ml-2 text-muted">{percent(step.ofPrevious)}</span>}
                  </span>
                </div>
                <div aria-hidden="true" className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(step.count / top) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted">With only a few accounts, one person changes these numbers a lot.</p>
        </section>

        <section aria-labelledby="signals-heading" className="card p-5">
          <h2 id="signals-heading" className="font-semibold">
            Other signs of real use
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {signals.map((s) => (
              <div key={s.label} className="rounded-lg bg-surface-2 px-4 py-3">
                <dt className="text-sm text-muted">{s.label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{s.count}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="weeks-heading" className="card p-5">
          <h2 id="weeks-heading" className="font-semibold">
            New accounts per week
          </h2>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">New accounts in each of the last eight weeks</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Week of</th>
                <th scope="col">New accounts</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.weekOf.toISOString()}>
                  <th scope="row" className="w-24 py-1 text-left font-normal text-muted">
                    {week(w.weekOf)}
                  </th>
                  <td className="py-1">
                    <div className="flex items-center gap-3">
                      <div aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(w.count / busiestWeek) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right tabular-nums">{w.count}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="months-heading" className="card p-5">
          <h2 id="months-heading" className="font-semibold">
            Activity by month
          </h2>
          <p className="mt-1 text-sm text-muted">The anonymous usage counts: just the kind of action and when, for everyone including you.</p>
          {months.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing counted in the last six months.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Usage counts by month</caption>
                <thead>
                  <tr className="text-left text-muted">
                    <th scope="col" className="py-1 pr-4 font-normal">
                      Month
                    </th>
                    {months[0].counts.map((c) => (
                      <th key={c.label} scope="col" className="py-1 pr-4 text-right font-normal">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month} className="border-t border-border">
                      <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                        {m.month}
                      </th>
                      {m.counts.map((c) => (
                        <td key={c.label} className="py-1.5 pr-4 text-right tabular-nums">
                          {c.count}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
