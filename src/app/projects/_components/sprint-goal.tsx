"use client";
import { Check } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { setChangeReason, updateSprintGoal } from "@/app/projects/sprint-actions";
import { FieldError, FormAlert } from "@/components/form-feedback";
import { emptyFormState } from "@/lib/form-state";
import { GOAL_OUTCOMES, REASONS } from "@/lib/sprint/reasons";
import { keepValuesOnSubmit } from "@/lib/keep-values-on-submit";

/** Tags a scope change with why it happened. Saves on change, no submit button. */
export function ReasonSelect({
  projectId,
  sprintId,
  changeId,
  storyKey,
  reason,
}: {
  projectId: string;
  sprintId: string;
  changeId: string;
  storyKey: string;
  reason: string | null;
}) {
  const [value, setValue] = useState(reason ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        aria-label={`Why ${storyKey} changed`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          setSaved(false);
          startTransition(async () => {
            await setChangeReason(projectId, sprintId, changeId, next);
            setSaved(true);
          });
        }}
        className={`field h-8 w-36 py-0 text-xs sm:w-44 ${value ? "" : "text-muted"}`}
      >
        <option value="">Not tagged</option>
        {REASONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <span aria-live="polite" className="w-4">
        {saved && <Check aria-label="Saved" className="h-4 w-4 text-ready" />}
      </span>
    </span>
  );
}

/** The sprint goal, and whether it was met. */
export function SprintGoalForm({
  projectId,
  sprintId,
  goal,
  outcome,
}: {
  projectId: string;
  sprintId: string;
  goal: string;
  outcome: string | null;
}) {
  const [state, action, pending] = useActionState(updateSprintGoal.bind(null, projectId, sprintId), emptyFormState);
  const [editing, setEditing] = useState(goal === "");
  const errors = state.fieldErrors ?? {};

  if (!editing) {
    const label = GOAL_OUTCOMES.find((o) => o.id === outcome)?.label;
    return (
      <div className="card flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="eyebrow">Sprint goal</p>
          <p className="mt-1 font-medium">{goal}</p>
          <p className="mt-1 text-sm text-muted">{label ? `Outcome: ${label}` : "Outcome not recorded yet."}</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(true)}>
          {label ? "Edit goal" : "Edit goal or record outcome"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="card space-y-3 p-4" noValidate>
      <div>
        <label htmlFor="goal" className="label">
          Sprint goal
        </label>
        <p id="goal-help" className="mt-0.5 text-sm text-muted">
          One sentence on what this sprint should achieve. It shows on the report.
        </p>
        <textarea
          id="goal"
          name="goal"
          rows={2}
          defaultValue={goal}
          placeholder="e.g. Customers can rebook a past cleaner in two taps"
          className="field mt-2"
          aria-invalid={errors.goal ? true : undefined}
          aria-describedby="goal-help goal-error"
        />
        <FieldError id="goal-error" message={errors.goal} />
      </div>
      <fieldset>
        <legend className="label">Was it met?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[{ id: "", label: "Not yet" }, ...GOAL_OUTCOMES].map((o) => (
            <label
              key={o.id}
              className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent-soft-foreground has-focus-visible:ring-2 has-focus-visible:ring-accent"
            >
              <input type="radio" name="goalOutcome" value={o.id} defaultChecked={(outcome ?? "") === o.id} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <FormAlert state={state} />
      <div className="flex gap-2">
        <button className="btn-primary btn-sm" disabled={pending}>
          {pending ? "Saving…" : "Save goal"}
        </button>
        {goal !== "" && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
