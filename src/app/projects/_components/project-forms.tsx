"use client";
import { useActionState } from "react";
import { createProject, deleteProject, renameProject } from "@/app/projects/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { FieldError, FormAlert } from "@/components/form-feedback";
import { emptyFormState } from "@/lib/form-state";

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProject, emptyFormState);
  return (
    <form action={action} className="card max-w-md space-y-3 p-5" noValidate>
      <h2 className="font-semibold">New project</h2>
      <div>
        <label htmlFor="project-name" className="label">
          Name
        </label>
        <input
          id="project-name"
          name="name"
          className="field mt-1"
          placeholder="e.g. Payments team backlog"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
          aria-describedby="project-name-error"
        />
        <FieldError id="project-name-error" message={state.fieldErrors?.name} />
      </div>
      <FormAlert state={state} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}

export function ProjectSettings({ projectId, name }: { projectId: string; name: string }) {
  const [state, action, pending] = useActionState(renameProject.bind(null, projectId), emptyFormState);
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
        <div className="min-w-60 flex-1">
          <label htmlFor="rename" className="label">
            Project name
          </label>
          <input
            id="rename"
            name="name"
            defaultValue={name}
            className="field mt-1"
            aria-invalid={state.fieldErrors?.name ? true : undefined}
            aria-describedby="rename-error"
          />
        </div>
        <button className="btn-secondary" disabled={pending}>
          Rename
        </button>
        <FieldError id="rename-error" message={state.fieldErrors?.name} />
      </form>
      <FormAlert state={state} />
      <ConfirmButton
        label="Delete project"
        title={`Delete ${name}?`}
        body="This removes the project's stories, scores, sprints and snapshots. It can't be undone."
        confirmLabel="Delete project"
        action={deleteProject.bind(null, projectId)}
      />
    </div>
  );
}
