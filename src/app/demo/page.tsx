import type { Metadata } from "next";
import Link from "next/link";
import { DemoBacklog } from "@/app/demo/demo-backlog";
import { DemoScorer } from "@/app/demo/demo-scorer";
import { ChangeTable } from "@/components/change-table";
import { SprintMetricsPanel } from "@/components/sprint-metrics";
import { DEMO_PROJECT_NAME, demoBacklog } from "@/demo/backlog";
import { demoSprint } from "@/demo/sprint";
import { DEFAULT_SETTINGS, readySummary, scoreStory } from "@/lib/readiness/rules";
import { formatDay } from "@/lib/sprint/dates";
import { computeMetrics } from "@/lib/sprint/metrics";
import { changeLog, compareReadiness, readinessFinding } from "@/lib/sprint/report";

export const metadata: Metadata = { title: "Demo" };

export default function DemoPage() {
  const scored = demoBacklog
    .map((story) => ({ story, readiness: scoreStory(story) }))
    .sort((a, b) => a.readiness.score - b.readiness.score || a.story.key.localeCompare(b.story.key));

  const snapshots = demoSprint.snapshots;
  const baseline = snapshots[0].stories;
  const latest = snapshots.at(-1)!.stories;
  const metrics = computeMetrics(baseline, latest);
  const finding = readinessFinding(compareReadiness(baseline, latest, DEFAULT_SETTINGS));

  return (
    <div className="space-y-10">
      <div>
        <p className="inline-block rounded-full bg-needs-work-bg px-3 py-1 text-xs font-medium text-needs-work">
          Demo: invented sample data, nothing is saved
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{DEMO_PROJECT_NAME}</h1>
        <p className="mt-1 text-muted">
          {readySummary(scored.map((s) => s.readiness))}. Weakest first, so you know what to fix before planning.
        </p>
      </div>

      <DemoBacklog scored={scored} />

      <section id="sample-sprint" aria-labelledby="sprint-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="sprint-heading" className="text-xl font-semibold">
              {demoSprint.name}
            </h2>
            <p className="text-sm text-muted">
              {formatDay(demoSprint.startDate)} to {formatDay(demoSprint.endDate)} · baseline locked on day one, then{" "}
              {snapshots.length - 1} later snapshots
            </p>
          </div>
          <Link href="/demo/report" className="btn-secondary">
            Open the sprint report
          </Link>
        </div>
        <p className="rounded-md bg-needs-work-bg px-3 py-2 text-sm text-needs-work">{finding}</p>
        <SprintMetricsPanel metrics={metrics} />
        <h3 className="font-semibold">Change log</h3>
        <ChangeTable caption="Every change in the sample sprint, newest first" rows={changeLog(snapshots)} />
      </section>

      <section aria-labelledby="try-heading" className="space-y-3">
        <h2 id="try-heading" className="text-xl font-semibold">
          Score your own story
        </h2>
        <p className="text-sm text-muted">
          Runs the same rules in your browser. Nothing is sent or saved. Don&apos;t paste confidential stories here
          either way.
        </p>
        <DemoScorer />
      </section>
    </div>
  );
}
