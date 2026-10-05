import { FolderPlus, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateProjectForm } from "@/app/projects/_components/project-forms";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { MAX_PROJECTS } from "@/lib/limits";
import { formatDay } from "@/lib/sprint/dates";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      stories: { select: { readiness: { select: { band: true } } } },
      _count: { select: { sprints: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Projects"
        description="One project per team or product backlog. Each holds its stories, scores and sprints."
      />

      {projects.length === 0 ? (
        <div id="new-project" className="scroll-mt-20">
          <EmptyState icon={FolderPlus} title="No projects yet." action={<CreateProjectForm framed={false} />}>
            Name your first one after the team or backlog it holds. Next you&apos;ll add its stories and see how ready
            they are.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const total = project.stories.length;
            const ready = project.stories.filter((s) => s.readiness?.band === "Ready").length;
            const share = total === 0 ? 0 : Math.round((ready / total) * 100);
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="card group block h-full p-5 transition-colors hover:border-accent/50"
                >
                  <p className="truncate font-semibold group-hover:text-accent">{project.name}</p>
                  <p className="mt-1 text-xs text-subtle">Updated {formatDay(project.updatedAt)}</p>
                  <div className="mt-5 space-y-2">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted">
                        {ready} of {total} {total === 1 ? "story" : "stories"} ready
                      </span>
                      <span className="font-medium tabular-nums">{share}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-ready-dot" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted">
                    <Timer aria-hidden="true" className="h-4 w-4" />
                    {project._count.sprints} {project._count.sprints === 1 ? "sprint" : "sprints"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {projects.length > 0 && (
        <div id="new-project" className="mt-8 scroll-mt-20">
          {projects.length < MAX_PROJECTS ? (
            <CreateProjectForm />
          ) : (
            <p className="text-sm text-muted">You have the maximum of {MAX_PROJECTS} projects.</p>
          )}
        </div>
      )}
    </>
  );
}
