import type { Metadata } from "next";
import { DeleteProjectButton, RenameProjectForm } from "@/app/projects/_components/project-forms";
import { SectionHeader } from "@/components/section-header";
import { DEFAULT_VAGUE_WORDS } from "@/lib/readiness/rules";
import { requireProject } from "@/lib/server/dal";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: PageProps<"/projects/[projectId]/settings">) {
  const project = await requireProject((await params).projectId);
  return (
    <>
      <SectionHeader title="Settings" description="Rename the project or delete it." />
      <div className="max-w-2xl space-y-6">
        <section aria-labelledby="general-heading" className="card space-y-4 p-5">
          <h2 id="general-heading" className="font-semibold">
            General
          </h2>
          <RenameProjectForm projectId={project.id} name={project.name} />
        </section>

        <section aria-labelledby="rules-heading" className="card space-y-3 p-5">
          <h2 id="rules-heading" className="font-semibold">
            Rule settings
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">Max story points</dt>
            <dd>{project.maxPoints}</dd>
            <dt className="text-muted">Vague words</dt>
            <dd className="text-muted">
              {project.vagueWords.length === DEFAULT_VAGUE_WORDS.length ? "The default list" : `${project.vagueWords.length} words`}:{" "}
              {project.vagueWords.join(", ")}
            </dd>
          </dl>
          <p className="text-xs text-subtle">Editing these comes with story R-6.</p>
        </section>

        <section aria-labelledby="danger-heading" className="card space-y-3 border-not-ready/30 p-5">
          <h2 id="danger-heading" className="font-semibold text-not-ready">
            Danger zone
          </h2>
          <p className="text-sm text-muted">Deleting removes every story, score, sprint and snapshot in this project.</p>
          <DeleteProjectButton projectId={project.id} name={project.name} />
        </section>
      </div>
    </>
  );
}
