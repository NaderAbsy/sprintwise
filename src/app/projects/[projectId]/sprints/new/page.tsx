import type { Metadata } from "next";
import { CreateSprintForm } from "@/app/projects/_components/sprint-forms";
import { SectionHeader } from "@/components/section-header";
import { requireProject } from "@/lib/server/dal";

export const metadata: Metadata = { title: "New sprint" };

export default async function NewSprintPage({ params }: PageProps<"/projects/[projectId]/sprints/new">) {
  const project = await requireProject((await params).projectId);
  return (
    <>
      <SectionHeader
        back={{ href: `/projects/${project.id}/sprints`, label: "Sprints" }}
        title="New sprint"
        description="Next you'll upload the day-one CSV and lock it as the baseline."
      />
      <CreateSprintForm projectId={project.id} />
    </>
  );
}
