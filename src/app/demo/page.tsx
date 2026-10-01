import type { Metadata } from "next";
import { DemoBacklog } from "@/app/demo/demo-backlog";
import { DemoScorer } from "@/app/demo/demo-scorer";
import { DEMO_PROJECT_NAME, demoBacklog } from "@/demo/backlog";
import { readySummary, scoreStory } from "@/lib/readiness/rules";

export const metadata: Metadata = { title: "Demo" };

export default function DemoPage() {
  const scored = demoBacklog
    .map((story) => ({ story, readiness: scoreStory(story) }))
    .sort((a, b) => a.readiness.score - b.readiness.score || a.story.key.localeCompare(b.story.key));

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
