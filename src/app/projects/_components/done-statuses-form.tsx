"use client";
import { useActionState } from "react";
import { updateDoneStatuses } from "@/app/projects/actions";
import { FieldError, FormAlert } from "@/components/form-feedback";
import { emptyFormState } from "@/lib/form-state";

/** Which statuses count as finished for completion and velocity, e.g. "Released" or "Accepted". */
export function DoneStatusesForm({ projectId, statuses }: { projectId: string; statuses: string[] }) {
  const [state, action, pending] = useActionState(updateDoneStatuses.bind(null, projectId), emptyFormState);
  const error = state.fieldErrors?.doneStatuses;
  return (
    <form key={statuses.join("|")} action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="doneStatuses" className="label">
          Done statuses
        </label>
        <p id="doneStatuses-help" className="mt-0.5 text-sm text-muted">
          Separate them with commas. Matching ignores case, so &ldquo;done&rdquo; matches &ldquo;Done&rdquo;.
        </p>
        <input
          id="doneStatuses"
          name="doneStatuses"
          defaultValue={statuses.join(", ")}
          className="field mt-2"
          aria-invalid={error ? true : undefined}
          aria-describedby="doneStatuses-help doneStatuses-error"
        />
        <FieldError id="doneStatuses-error" message={error} />
      </div>
      <FormAlert state={state} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save statuses"}
      </button>
    </form>
  );
}
