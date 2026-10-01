import type { Metadata } from "next";
import Link from "next/link";
import { CreateProjectForm } from "@/app/projects/_components/project-forms";
import { MAX_PROJECTS } from "@/lib/limits";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { stories: true, sprints: true } } },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Projects</h1>

      {projects.length === 0 ? (
        <p className="text-muted">No projects yet. Create one for each team or product backlog.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link href={`/projects/${project.id}`} className="card block p-4 hover:border-accent">
                <span className="font-medium">{project.name}</span>
                <span className="mt-1 block text-sm text-muted">
                  {project._count.stories} {project._count.stories === 1 ? "story" : "stories"} ·{" "}
                  {project._count.sprints} {project._count.sprints === 1 ? "sprint" : "sprints"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {projects.length < MAX_PROJECTS ? (
        <CreateProjectForm />
      ) : (
        <p className="text-sm text-muted">You have the maximum of {MAX_PROJECTS} projects.</p>
      )}
    </div>
  );
}
