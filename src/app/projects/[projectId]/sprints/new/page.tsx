import type { Metadata } from "next";
import Link from "next/link";
import { CreateSprintForm } from "@/app/projects/_components/sprint-forms";
import { requireProject } from "@/lib/server/dal";

export const metadata: Metadata = { title: "New sprint" };

export default async function NewSprintPage({ params }: PageProps<"/projects/[projectId]/sprints/new">) {
  const project = await requireProject((await params).projectId);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          <Link href={`/projects/${project.id}`} className="hover:underline">
            {project.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">New sprint</h1>
        <p className="mt-1 text-muted">Next you&apos;ll upload the day-one CSV and lock it as the baseline.</p>
      </div>
      <CreateSprintForm projectId={project.id} />
    </div>
  );
}
