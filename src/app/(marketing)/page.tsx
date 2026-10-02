import { ArrowRight, ClipboardCheck, FileSpreadsheet, Lock, Printer } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth-buttons";
import { BandBadge } from "@/components/band-badge";
import { ScoreRing } from "@/components/score-ring";
import { demoBacklog } from "@/demo/backlog";
import { demoSprint } from "@/demo/sprint";
import { scoreStory } from "@/lib/readiness/rules";
import { computeMetrics, formatPercent } from "@/lib/sprint/metrics";
import { getSession } from "@/lib/server/dal";

const STEPS = [
  {
    Icon: ClipboardCheck,
    title: "Score every story",
    text: "Nine fixed rules score each story out of 100, with a plain-English reason for every point lost.",
  },
  {
    Icon: Lock,
    title: "Lock the baseline",
    text: "Upload the sprint as committed on day one. It can't be edited, so every change is measured against it.",
  },
  {
    Icon: Printer,
    title: "Report what changed",
    text: "Scope added and removed, churn and completion, on one printable page for the retrospective.",
  },
];

export default async function Home() {
  if (await getSession()) redirect("/projects");

  // The preview cards use the same invented demo data and the same rules as the app.
  const weakest = demoBacklog.map((s) => ({ story: s, r: scoreStory(s) })).sort((a, b) => a.r.score - b.r.score)[1];
  const failed = weakest.r.rules.filter((r) => !r.passed).slice(0, 3);
  const metrics = computeMetrics(demoSprint.snapshots[0].stories, demoSprint.snapshots.at(-1)!.stories);

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            For Product Owners and Scrum teams
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Were we ready, and did we stick to it?
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted text-pretty">
            Sprintwise scores user stories for readiness before planning, then measures how much the sprint changes
            after the team commits. No Jira setup: paste a story or upload a CSV.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/demo" className="btn-primary h-10 px-4">
              Try the demo
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <SignInButton className="btn-secondary h-10 px-4" />
          </div>
          <p className="mt-3 text-sm text-subtle">The demo needs no account and saves nothing.</p>
        </div>

        <div aria-hidden="true" className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-accent/15 via-transparent to-transparent blur-2xl" />
          <div className="card space-y-4 p-5">
            <div className="flex items-center gap-4">
              <ScoreRing score={weakest.r.score} band={weakest.r.band} size="md" />
              <div className="min-w-0">
                <p className="font-mono text-xs text-subtle">{weakest.story.key}</p>
                <p className="truncate font-medium">{weakest.story.title}</p>
                <div className="mt-1">
                  <BandBadge band={weakest.r.band} />
                </div>
              </div>
            </div>
            <ul className="space-y-2 border-t border-border pt-4 text-sm">
              {failed.map((rule) => (
                <li key={rule.id} className="flex gap-3">
                  <span className="w-8 shrink-0 font-mono text-not-ready">−{rule.points}</span>
                  <span className="text-muted">{rule.check}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card mt-4 grid grid-cols-3 divide-x divide-border p-0 sm:ml-12">
            {[
              ["Net change", formatPercent(metrics.netChange, { signed: true })],
              ["Churn", formatPercent(metrics.churn)],
              ["Completion", formatPercent(metrics.completion)],
            ].map(([label, value]) => (
              <div key={label} className="px-4 py-3">
                <p className="text-xs text-subtle">{label}</p>
                <p className="text-lg font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="border-t border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="how-heading" className="text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ Icon, title, text }, i) => (
              <li key={title} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground">
                    <Icon aria-hidden="true" className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm text-subtle">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="card flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground">
              <FileSpreadsheet aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold">Works with what you already export</h2>
              <p className="mt-1 text-sm text-muted">
                Upload a CSV in the Sprintwise template, or a Jira export with Issue key, Summary and Story Points.
              </p>
            </div>
          </div>
          <Link href="/demo" className="btn-secondary shrink-0">
            See a sample sprint
          </Link>
        </div>
      </section>
    </>
  );
}
