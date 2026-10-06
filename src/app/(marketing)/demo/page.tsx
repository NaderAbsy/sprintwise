import { FileText, FlaskConical, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoBacklog } from "@/app/(marketing)/demo/demo-backlog";
import { DemoScorer } from "@/app/(marketing)/demo/demo-scorer";
import { ChangeTable } from "@/components/change-table";
import { SprintMetricsPanel } from "@/components/sprint-metrics";
import { DEMO_PROJECT_NAME, demoBacklog } from "@/demo/backlog";
import { demoTrendRows } from "@/demo/history";
import { demoLog, demoSprint } from "@/demo/sprint";
import { Trends } from "@/components/trends";
import { summarizeTrends } from "@/lib/sprint/trends";
import { DEFAULT_SETTINGS, readySummary, scoreStory } from "@/lib/readiness/rules";
import { formatDay } from "@/lib/sprint/dates";
import { computeMetrics } from "@/lib/sprint/metrics";
import { compareReadiness, readinessFinding } from "@/lib/sprint/report";

export const metadata: Metadata = { title: "Demo" };

export default function DemoPage() {
  const scored = demoBacklog
    .map((story) => ({ story, readiness: scoreStory(story) }))
    .sort((a, b) => a.readiness.score - b.readiness.score || a.story.key.localeCompare(b.story.key));

  const snapshots = demoSprint.snapshots;
  const baseline = snapshots[0].stories;
  const latest = snapshots.at(-1)!.stories;
  const metrics = computeMetrics(baseline, latest);
  const trendRows = demoTrendRows();
  const finding = readinessFinding(compareReadiness(baseline, latest, DEFAULT_SETTINGS));

  const sections = [
    { href: "#backlog", label: "Sample backlog" },
    { href: "#sample-sprint", label: "Sample sprint" },
    { href: "#trends", label: "Trends" },
    { href: "#try-it", label: "Score your own" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 rounded-full bg-needs-work-bg px-3 py-1 text-xs font-medium text-needs-work">
          <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
          Demo: invented sample data, nothing is saved
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{DEMO_PROJECT_NAME}</h1>
        <p className="max-w-2xl text-muted">
          {readySummary(scored.map((s) => s.readiness))}. Weakest first, so you know what to fix before planning.
        </p>
      </header>

      <nav
        aria-label="Demo sections"
        className="no-print sticky top-14 z-20 -mx-4 mt-6 mb-8 border-b border-border bg-background/85 px-4 backdrop-blur sm:-mx-6 sm:px-6"
      >
        <ul className="flex gap-1 overflow-x-auto">
          {sections.map((section) => (
            <li key={section.href}>
              <a
                href={section.href}
                className="inline-block border-b-2 border-transparent px-3 py-2.5 text-sm whitespace-nowrap text-muted hover:border-border-strong hover:text-foreground"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-16">
        <section id="backlog" aria-label="Sample backlog" className="scroll-mt-32">
          <DemoBacklog scored={scored} />
        </section>

        <section id="sample-sprint" aria-labelledby="sprint-heading" className="scroll-mt-32 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="sprint-heading" className="text-xl font-semibold tracking-tight">
                {demoSprint.name}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {formatDay(demoSprint.startDate)} to {formatDay(demoSprint.endDate)} · baseline locked on day one, then{" "}
                {snapshots.length - 1} later snapshots
              </p>
            </div>
            <Link href="/demo/report" className="btn-primary">
              <FileText aria-hidden="true" className="h-4 w-4" />
              Open the sprint report
            </Link>
          </div>
          <p className="text-sm">
            <span className="font-medium">Goal:</span> {demoSprint.goal}{" "}
            <span className="ml-1 rounded-full bg-needs-work-bg px-2 py-0.5 text-xs font-medium text-needs-work">Partly met</span>
          </p>
          <p className="flex items-start gap-3 rounded-xl border border-needs-work-dot/30 bg-needs-work-bg px-4 py-3 text-sm text-needs-work">
            <Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {finding}
          </p>
          <SprintMetricsPanel metrics={metrics} />
          <div className="space-y-3">
            <h3 className="font-semibold">Change log</h3>
            <ChangeTable caption="Every change in the sample sprint, newest first" rows={demoLog()} reasons="text" />
            <p className="text-xs text-muted">In the app, the PO tags why each scope change happened and the report adds them up.</p>
          </div>
        </section>

        <section id="trends" aria-labelledby="trends-heading" className="scroll-mt-32 space-y-4">
          <div>
            <h2 id="trends-heading" className="text-xl font-semibold tracking-tight">
              Trends across sprints
            </h2>
            <p className="mt-1 text-sm text-muted">
              Six invented Tidyhome sprints. As the team planned with more Ready stories, churn fell and completion rose,
              until Sprint 12 committed two unclear stories again.
            </p>
          </div>
          <Trends rows={trendRows} summary={summarizeTrends(trendRows)} />
        </section>

        <section id="try-it" aria-labelledby="try-heading" className="scroll-mt-32 space-y-4">
          <div>
            <h2 id="try-heading" className="text-xl font-semibold tracking-tight">
              Score your own story
            </h2>
            <p className="mt-1 text-sm text-muted">
              Runs the same rules in your browser. Nothing is sent or saved. Don&apos;t paste confidential stories here
              either way.
            </p>
          </div>
          <DemoScorer />
        </section>
      </div>
    </div>
  );
}
