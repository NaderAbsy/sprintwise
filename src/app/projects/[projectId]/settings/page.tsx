import type { Metadata } from "next";
import { DeleteProjectButton, RenameProjectForm } from "@/app/projects/_components/project-forms";
import { SectionHeader } from "@/components/section-header";
import { CustomChecksForm } from "@/app/projects/_components/custom-checks-form";
import { DoneStatusesForm } from "@/app/projects/_components/done-statuses-form";
import { RuleSettingsForm } from "@/app/projects/_components/rule-settings-form";
import { isDefault } from "@/lib/readiness/settings";
import { settingsOf } from "@/lib/server/readiness";
import { requireProject } from "@/lib/server/dal";
import { doneStatusesOf } from "@/lib/server/sprint";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: PageProps<"/projects/[projectId]/settings">) {
  const project = await requireProject((await params).projectId);
  return (
    <>
      <SectionHeader title="Settings" description="Rename the project, tune its readiness rules, choose when a story counts as done, or delete it." />
      <div className="max-w-2xl space-y-6">
        <section aria-labelledby="general-heading" className="card space-y-4 p-5">
          <h2 id="general-heading" className="font-semibold">
            General
          </h2>
          <RenameProjectForm projectId={project.id} name={project.name} />
        </section>

        <section aria-labelledby="rules-heading" className="card space-y-4 p-5">
          <div>
            <h2 id="rules-heading" className="font-semibold">
              Rule settings
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Tune the rules to your team. Saving re-scores every story in this project.
            </p>
          </div>
          <RuleSettingsForm
            projectId={project.id}
            maxPoints={project.maxPoints}
            vagueWords={project.vagueWords}
            isDefault={isDefault(settingsOf(project))}
          />
        </section>

        <section aria-labelledby="checks-heading" className="card space-y-4 p-5">
          <div>
            <h2 id="checks-heading" className="font-semibold">
              Your team&apos;s checks
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Add your own Definition of Ready items. They don&apos;t change the score, but a story that fails one
              can&apos;t be Ready. Matching ignores case.
            </p>
          </div>
          <CustomChecksForm projectId={project.id} checks={settingsOf(project).customChecks ?? []} />
        </section>

        <section aria-labelledby="done-heading" className="card space-y-4 p-5">
          <div>
            <h2 id="done-heading" className="font-semibold">
              When is a story done?
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Sprint completion and velocity count stories with these statuses. Use your team&apos;s words, such as
              Released or Accepted.
            </p>
          </div>
          <DoneStatusesForm projectId={project.id} statuses={doneStatusesOf(project)} />
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
