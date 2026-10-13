import type { Metadata } from "next";
import { CreateSprintForm } from "@/app/projects/_components/sprint-forms";
import { SectionHeader } from "@/components/section-header";
import { db } from "@/lib/server/db";
import { requireProject } from "@/lib/server/dal";
import { nextSprintName, toDay } from "@/lib/sprint/dates";

export const metadata: Metadata = { title: "New sprint" };

export default async function NewSprintPage({ params }: PageProps<"/projects/[projectId]/sprints/new">) {
  const project = await requireProject((await params).projectId);
  // The next sprint usually follows the last one: the next number, starting the day after, the same length.
  const last = await db.sprint.findFirst({
    where: { projectId: project.id },
    orderBy: { startDate: "desc" },
    select: { name: true, startDate: true, endDate: true },
  });
  const suggestion = {
    name: nextSprintName(last?.name),
    ...(last && {
      after: toDay(new Date(last.endDate.getTime() + 86_400_000)),
      days: Math.round((last.endDate.getTime() - last.startDate.getTime()) / 86_400_000) + 1,
    }),
  };
  return (
    <>
      <SectionHeader
        back={{ href: `/projects/${project.id}/sprints`, label: "Sprints" }}
        title="New sprint"
        description="Next you'll pick the stories the team committed to on day one and lock them as the baseline."
      />
      <CreateSprintForm projectId={project.id} suggestion={suggestion} />
    </>
  );
}
