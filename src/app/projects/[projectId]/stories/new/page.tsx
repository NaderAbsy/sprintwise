import type { Metadata } from "next";
import { AddStoryForm } from "@/app/projects/_components/add-story-form";
import { SectionHeader } from "@/components/section-header";
import { requireProject } from "@/lib/server/dal";

export const metadata: Metadata = { title: "Score a story" };

export default async function NewStoryPage({ params }: PageProps<"/projects/[projectId]/stories/new">) {
  const project = await requireProject((await params).projectId);
  return (
    <>
      <SectionHeader
        back={{ href: `/projects/${project.id}`, label: "Backlog" }}
        title="Score a story"
        description="Paste a story to score it and save it to this project. Only the title is required."
      />
      <div className="max-w-2xl">
        <AddStoryForm projectId={project.id} />
      </div>
    </>
  );
}
