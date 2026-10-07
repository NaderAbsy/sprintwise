"use client";
import { Check, LoaderCircle } from "lucide-react";
import { useActionState, useRef } from "react";
import { quickUpdateStory } from "@/app/projects/actions";
import { emptyFormState } from "@/lib/form-state";

/**
 * A story's status or points, edited in place in a list. A status is picked
 * from a list and saves at once. Points save when you press Enter or leave the
 * field with a changed value; Escape puts them back.
 */
export function QuickField({
  projectId,
  storyId,
  storyKey,
  field,
  value,
  options = [],
}: {
  projectId: string;
  storyId: string;
  storyKey: string;
  field: "status" | "storyPoints";
  value: string;
  /** The statuses to choose from; the story's own is added when it isn't one of them. */
  options?: string[];
}) {
  const [state, action, pending] = useActionState(quickUpdateStory.bind(null, projectId, storyId), emptyFormState);
  const form = useRef<HTMLFormElement>(null);
  const label = field === "status" ? `Status of ${storyKey}` : `Points for ${storyKey}`;
  const errorId = `${field}-${storyId}-error`;
  // The story's own status, spelt as in the list when it's one of them ("in progress" is In Progress).
  const current = options.find((o) => o.toLowerCase() === value.trim().toLowerCase()) ?? value.trim();
  const choices = options.includes(current) ? options : [current, ...options];

  return (
    // key: after a save the page re-renders with the stored value, and the input starts from it.
    <form key={value} ref={form} action={action} className="relative flex items-center gap-1.5">
      <input type="hidden" name="field" value={field} />
      {field === "status" ? (
        <select
          name="value"
          aria-label={label}
          defaultValue={current}
          className="field h-8 w-28 py-1 pl-2 text-sm sm:w-36"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
          onChange={() => form.current?.requestSubmit()}
        >
          {choices.map((o) => (
            <option key={o} value={o}>
              {o || "No status"}
            </option>
          ))}
        </select>
      ) : (
        <input
          name="value"
          aria-label={label}
          defaultValue={value}
          inputMode="decimal"
          placeholder="—"
          autoComplete="off"
          className="field h-8 w-16 px-2 py-1 text-right text-sm tabular-nums"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
          onBlur={(event) => {
            if (event.currentTarget.value.trim() !== value) form.current?.requestSubmit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.value = value;
          }}
        />
      )}
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

/** Suggestions for a box where a new status can be typed. */
export function StatusOptions({ id, options }: { id: string; options: string[] }) {
  return (
    <datalist id={id}>
      {options.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  );
}
