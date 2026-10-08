import { LineChart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { Trends } from "@/components/trends";
import { summarizeTrends } from "@/lib/sprint/trends";
import { requireProject } from "@/lib/server/dal";
import { loadProjectTrends } from "@/lib/server/sprint";

export const metadata: Metadata = { title: "Trends" };

export default async function TrendsPage({ params }: PageProps<"/projects/[projectId]/trends">) {
  const project = await requireProject((await params).projectId);
  const rows = await loadProjectTrends(project);
  const measured = rows.filter((r) => r.measured);

  return (
    <>
      <SectionHeader
        title="Trends"
        description="How the team's sprints are going over time: velocity, completion, churn, and how Ready stories were at planning."
      />
      {measured.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="No trends yet."
          action={
            <Link href={`/projects/${project.id}/sprints`} className="btn-primary">
              Go to sprints
            </Link>
          }
        >
          {rows.some((r) => r.running)
            ? "Trends appear when a sprint ends, so a sprint still running doesn't skew the averages. "
            : "Trends appear once a sprint has a locked baseline and a later snapshot, and has ended. "}
          From the second sprint, Sprintwise compares it with the one before; from the fourth, it compares averages.
        </EmptyState>
      ) : (
        <Trends rows={rows} summary={summarizeTrends(rows)} />
      )}
    </>
  );
}
