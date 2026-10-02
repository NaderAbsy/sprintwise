import type { Metadata } from "next";
import { SprintReport } from "@/components/sprint-report";
import { DEMO_PROJECT_NAME } from "@/demo/backlog";
import { demoSprint } from "@/demo/sprint";
import { DEFAULT_SETTINGS } from "@/lib/readiness/rules";
import { changeLog } from "@/lib/sprint/report";

export const metadata: Metadata = { title: "Sample sprint report" };

export default function DemoReportPage() {
  const snapshots = demoSprint.snapshots;
  const latest = snapshots.at(-1)!;
  return (
    <SprintReport
      projectName={DEMO_PROJECT_NAME}
      sprint={demoSprint}
      baseline={snapshots[0].stories}
      latest={latest.stories}
      latestAsOf={latest.asOfDate}
      log={changeLog(snapshots)}
      settings={DEFAULT_SETTINGS}
      back={{ href: "/demo#sample-sprint", label: "Back to the demo" }}
    />
  );
}
