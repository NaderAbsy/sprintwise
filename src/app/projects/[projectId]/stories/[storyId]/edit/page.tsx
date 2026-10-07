import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryEditor } from "@/app/projects/_components/story-editor";
import { SectionHeader } from "@/components/section-header";
import { db } from "@/lib/server/db";
import { requireProject } from "@/lib/server/dal";
import { settingsOf } from "@/lib/server/readiness";

export const metadata: Metadata = { title: "Edit story" };

export default async function EditStoryPage({ params, searchParams }: PageProps<"/projects/[projectId]/stories/[storyId]/edit">) {
  const { projectId, storyId } = await params;
  // Opened from refinement mode: saving or cancelling goes back to the same story there.
  const back = (await searchParams).return;
  const fromRefine = back === "refine" || back === "refine-all" ? back : undefined;
  const refineHref = (id: string) => `/projects/${projectId}/refine?story=${id}${fromRefine === "refine-all" ? "&scope=all" : ""}`;
  const project = await requireProject(projectId);
  const story = await db.story.findFirst({ where: { id: storyId, projectId: project.id } });
  if (!story) notFound();

  return (
    <>
      <SectionHeader
        back={
          fromRefine
            ? { href: refineHref(story.id), label: "Refinement" }
            : { href: `/projects/${project.id}/stories/${story.id}`, label: story.key }
        }
        title={`Edit ${story.key}`}
        description="Fix what the score points out. The key can't change, because sprints match stories by key."
      />
      <StoryEditor projectId={project.id} settings={settingsOf(project)} story={story} returnToRefine={fromRefine} />
    </>
  );
}
