"use client";
import { useActionState } from "react";
import { createProject, deleteProject, renameProject } from "@/app/projects/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { FieldError, FormAlert } from "@/components/form-feedback";
import { emptyFormState } from "@/lib/form-state";

/** `framed={false}` drops the card and heading, for the empty projects page that already explains it. */
export function CreateProjectForm({ framed = true }: { framed?: boolean }) {
  const [state, action, pending] = useActionState(createProject, emptyFormState);
  return (
    <form action={action} className={framed ? "card max-w-xl space-y-4 p-5" : "w-full max-w-md space-y-3 text-left"} noValidate>
      {framed && (
        <div>
          <h2 className="font-semibold">New project</h2>
          <p className="mt-0.5 text-sm text-muted">Name it after the team or backlog it holds.</p>
        </div>
      )}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="project-name" className="sr-only">
            Name
          </label>
          <input
            id="project-name"
            name="name"
            className="field"
            placeholder="e.g. Payments team backlog"
            aria-invalid={state.fieldErrors?.name ? true : undefined}
            aria-describedby="project-name-error"
          />
          <FieldError id="project-name-error" message={state.fieldErrors?.name} />
        </div>
        <button className="btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
      <FormAlert state={state} />
    </form>
  );
}

export function RenameProjectForm({ projectId, name }: { projectId: string; name: string }) {
  const [state, action, pending] = useActionState(renameProject.bind(null, projectId), emptyFormState);
  return (
    <form action={action} className="space-y-3" noValidate>
      <label htmlFor="rename" className="label">
        Project name
      </label>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-56 flex-1">
          <input
            id="rename"
            name="name"
            defaultValue={name}
            className="field"
            aria-invalid={state.fieldErrors?.name ? true : undefined}
            aria-describedby="rename-error"
          />
          <FieldError id="rename-error" message={state.fieldErrors?.name} />
        </div>
        <button className="btn-secondary" disabled={pending}>
          {pending ? "Saving…" : "Rename"}
        </button>
      </div>
      <FormAlert state={state} />
    </form>
  );
}

export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  return (
    <ConfirmButton
      label="Delete project"
      title={`Delete ${name}?`}
      body="This removes the project's stories, scores, sprints and snapshots. It can't be undone."
      confirmLabel="Delete project"
      action={deleteProject.bind(null, projectId)}
    />
  );
}
