"use client";
import { Check, LoaderCircle } from "lucide-react";
import { useActionState, useRef } from "react";
import { quickUpdateStory } from "@/app/projects/actions";
import { emptyFormState } from "@/lib/form-state";

/**
 * A story's status or points, edited in place in a list. It saves when you
 * press Enter or leave the field with a changed value; Escape puts it back.
 */
export function QuickField({
  projectId,
  storyId,
  storyKey,
  field,
  value,
  listId,
}: {
  projectId: string;
  storyId: string;
  storyKey: string;
  field: "status" | "storyPoints";
  value: string;
  /** The id of a <datalist> of statuses to suggest. */
  listId?: string;
}) {
  const [state, action, pending] = useActionState(quickUpdateStory.bind(null, projectId, storyId), emptyFormState);
  const form = useRef<HTMLFormElement>(null);
  const label = field === "status" ? `Status of ${storyKey}` : `Points for ${storyKey}`;
  const errorId = `${field}-${storyId}-error`;

  return (
    // key: after a save the page re-renders with the stored value, and the input starts from it.
    <form key={value} ref={form} action={action} className="relative flex items-center gap-1.5">
      <input type="hidden" name="field" value={field} />
      <input
        name="value"
        aria-label={label}
        defaultValue={value}
        list={listId}
        inputMode={field === "storyPoints" ? "decimal" : undefined}
        placeholder={field === "storyPoints" ? "—" : "To Do"}
        autoComplete="off"
        className={`field h-8 px-2 py-1 text-sm ${field === "storyPoints" ? "w-16 text-right tabular-nums" : "w-24 sm:w-32"}`}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? errorId : undefined}
        onBlur={(event) => {
          if (event.currentTarget.value.trim() !== value) form.current?.requestSubmit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.value = value;
        }}
      />
      <span aria-live="polite" className="w-4 shrink-0">
        {pending ? (
          <LoaderCircle aria-label="Saving" className="h-4 w-4 animate-spin text-muted" />
        ) : state.message ? (
          <Check aria-label={`${label} saved`} className="h-4 w-4 text-ready" />
        ) : null}
      </span>
      {state.error && (
        <p id={errorId} role="alert" className="absolute top-full left-0 z-10 mt-1 w-48 rounded bg-not-ready-bg px-2 py-1 text-xs text-not-ready">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** Status suggestions: the usual workflow, then the project's own done statuses. */
export function StatusOptions({ id, doneStatuses }: { id: string; doneStatuses: string[] }) {
  const options = [...new Set(["To Do", "In Progress", ...doneStatuses])];
  return (
    <datalist id={id}>
      {options.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  );
}
