import type { Metadata } from "next";
import Link from "next/link";
import { AddStoryForm } from "@/app/projects/_components/add-story-form";
import { requireProject } from "@/lib/server/dal";

export const metadata: Metadata = { title: "Score a story" };

export default async function NewStoryPage({ params }: PageProps<"/projects/[projectId]/stories/new">) {
  const project = await requireProject((await params).projectId);
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted">
          <Link href={`/projects/${project.id}`} className="hover:underline">
            {project.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Score a story</h1>
        <p className="mt-1 text-muted">Paste a story to score it and save it to this project.</p>
      </div>
      <AddStoryForm projectId={project.id} />
    </div>
  );
}
