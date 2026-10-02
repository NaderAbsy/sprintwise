import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProjectTabs } from "@/components/project-tabs";
import { requireProject } from "@/lib/server/dal";

/** Every project page keeps the project name and its tabs in view. */
export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[projectId]">) {
  const project = await requireProject((await params).projectId);
  return (
    <>
      <div className="no-print mb-6 border-b border-border">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1 text-sm text-muted">
            <li>
              <Link href="/projects" className="rounded hover:text-foreground">
                Projects
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-subtle" />
              <span className="truncate text-foreground">{project.name}</span>
            </li>
          </ol>
        </nav>
        <p className="mb-3 truncate text-2xl font-semibold tracking-tight">{project.name}</p>
        <ProjectTabs projectId={project.id} />
      </div>
      {children}
    </>
  );
}
