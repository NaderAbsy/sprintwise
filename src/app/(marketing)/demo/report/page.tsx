import type { Metadata } from "next";
import { SprintReport } from "@/components/sprint-report";
import { DEMO_PROJECT_NAME } from "@/demo/backlog";
import { demoLog, demoSprint } from "@/demo/sprint";
import { DEFAULT_SETTINGS } from "@/lib/readiness/rules";

// The sample sprint is dated from today (src/demo/sprint.ts), so rebuild the page daily.
export const revalidate = 86400;

export const metadata: Metadata = { title: "Sample sprint report" };

export default function DemoReportPage() {
  const snapshots = demoSprint.snapshots;
  const latest = snapshots.at(-1)!;
  return (
    <div className="px-4 py-10 sm:px-6">
      <SprintReport
      projectName={DEMO_PROJECT_NAME}
      sprint={demoSprint}
      baseline={snapshots[0].stories}
      latest={latest.stories}
      latestAsOf={latest.asOfDate}
      log={demoLog()}
      settings={DEFAULT_SETTINGS}
      snapshots={snapshots.map((s) => ({ asOfDate: s.asOfDate, items: s.stories }))}
        back={{ href: "/demo#sample-sprint", label: "Back to the demo" }}
      />
    </div>
  );
}
