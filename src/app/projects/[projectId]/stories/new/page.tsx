import type { Metadata } from "next";
import { StoryEditor } from "@/app/projects/_components/story-editor";
import { SectionHeader } from "@/components/section-header";
import { requireProject } from "@/lib/server/dal";
import { settingsOf } from "@/lib/server/readiness";

export const metadata: Metadata = { title: "Score a story" };

export default async function NewStoryPage({ params }: PageProps<"/projects/[projectId]/stories/new">) {
  const project = await requireProject((await params).projectId);
  return (
    <>
      <SectionHeader
        back={{ href: `/projects/${project.id}`, label: "Backlog" }}
        title="Score a story"
        description="Paste or type a story. The score updates as you type; only the title is required to save."
      />
      <StoryEditor projectId={project.id} settings={settingsOf(project)} />
    </>
  );
}
