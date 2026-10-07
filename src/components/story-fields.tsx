"use client";
import { RotateCcw } from "lucide-react";
import { FieldError } from "@/components/form-feedback";
import type { StoryCompare, StoryDefaults, StoryFieldName } from "@/lib/stories/compare";

/** Puts a field back to its saved value, as if typed, so the live score follows. */
function restore(name: StoryFieldName, value: string) {
  const field = document.getElementById(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.focus();
}

function Changed({ name, label, compare }: { name: StoryFieldName; label: string; compare: StoryCompare }) {
  if (compare.current[name].trim() === compare.before[name].trim()) return null;
  return (
    <span className="ml-auto flex items-center gap-2">
      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-foreground">Changed</span>
      <button
        type="button"
        className="btn-ghost btn-sm"
        // Named "Restore"; the field's label describes it, so it doesn't compete with the field for that name.
        aria-describedby={`${name}-label`}
        title={`Put back the saved ${label.toLowerCase()}`}
        onClick={() => restore(name, compare.before[name])}
      >
        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
        Restore
      </button>
    </span>
  );
}

/**
 * A long text field. Editing a saved story shows the saved text beside the
 * field (above it on phones), so the new version can be written against it.
 */
function TextField({
  name,
  label,
  hint,
  compare,
  children,
}: {
  name: StoryFieldName;
  label: string;
  hint?: string;
  compare?: StoryCompare;
  children: React.ReactNode;
}) {
  const heading = (
    <label id={`${name}-label`} htmlFor={name} className="label">
      {label} {hint && <span className="font-normal text-muted">({hint})</span>}
    </label>
  );
  if (!compare) {
    return (
      <div>
        {heading}
        {children}
      </div>
    );
  }
  const before = compare.before[name];
  return (
    <div>
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {heading}
        <Changed name={name} label={label} compare={compare} />
      </div>
      <div className="mt-1 grid gap-2 md:grid-cols-2 md:gap-4">
        <div>
          <p id={`${name}-before-label`} className="text-xs font-medium tracking-wide text-subtle uppercase">
            Before
          </p>
          <div
            id={`${name}-before`}
            className={`mt-1 min-h-10 rounded-lg border border-dashed border-border-strong bg-surface-2/50 px-3 py-2 text-sm break-words whitespace-pre-wrap ${
              name === "acceptanceCriteria" ? "font-mono text-xs" : ""
            } ${before ? "text-muted" : "text-subtle italic"}`}
          >
            {before || "Empty"}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-subtle uppercase md:block" aria-hidden="true">
            New version
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}

/** "Before: 3" under a short field, with the change marker. */
function ShortBefore({ name, label, compare }: { name: StoryFieldName; label: string; compare?: StoryCompare }) {
  if (!compare) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span id={`${name}-before`}>Before: {compare.before[name] || "empty"}</span>
      <Changed name={name} label={label} compare={compare} />
    </div>
  );
}

/** The story inputs shared by the project forms and the demo. Uncontrolled, so `defaults` fill them once. */
export function StoryFields({
  errors = {},
  showKey = false,
  showStatus = showKey,
  defaults = {},
  compare,
}: {
  errors?: Record<string, string>;
  showKey?: boolean;
  showStatus?: boolean;
  defaults?: StoryDefaults;
  /** Editing a saved story: show what it said before each field. */
  compare?: StoryCompare;
}) {
  const invalid = (name: string) => (errors[name] ? true : undefined);
  // The saved text is part of each field's description, so screen readers hear it too.
  const describedBy = (name: StoryFieldName) => [`${name}-error`, compare && `${name}-before`].filter(Boolean).join(" ");
  return (
    <>
      {showKey && (
        <div>
          <label htmlFor="key" className="label">
            Key <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="key"
            name="key"
            className="field mt-1 max-w-48 font-mono"
            placeholder="PROJ-12"
            aria-invalid={invalid("key")}
            aria-describedby="key-error"
          />
          <FieldError id="key-error" message={errors.key} />
        </div>
      )}
      <TextField name="title" label="Title" compare={compare}>
        <input
          id="title"
          name="title"
          defaultValue={defaults.title}
          className="field mt-1"
          aria-invalid={invalid("title")}
          aria-describedby={describedBy("title")}
        />
        <FieldError id="title-error" message={errors.title} />
      </TextField>
      <TextField name="description" label="Description" compare={compare}>
        <textarea
          id="description"
          name="description"
          rows={compare ? 4 : 3}
          defaultValue={defaults.description}
          className="field mt-1"
          placeholder="As a … I want … so that …"
          aria-invalid={invalid("description")}
          aria-describedby={describedBy("description")}
        />
        <FieldError id="description-error" message={errors.description} />
      </TextField>
      <TextField name="acceptanceCriteria" label="Acceptance criteria" hint="one per line" compare={compare}>
        <textarea
          id="acceptanceCriteria"
          name="acceptanceCriteria"
          rows={compare ? 5 : 4}
          defaultValue={defaults.acceptanceCriteria}
          className="field mt-1 font-mono text-xs"
          placeholder={"- The customer gets an email within 1 minute\n- The refund shows on the order page"}
          aria-invalid={invalid("acceptanceCriteria")}
          aria-describedby={describedBy("acceptanceCriteria")}
        />
        <FieldError id="acceptanceCriteria-error" message={errors.acceptanceCriteria} />
      </TextField>
      <div className="flex flex-wrap gap-6">
        <div>
          <label id="storyPoints-label" htmlFor="storyPoints" className="label">
            Story points
          </label>
          <input
            id="storyPoints"
            name="storyPoints"
            inputMode="decimal"
            defaultValue={defaults.storyPoints ?? undefined}
            className="field mt-1 w-28"
            aria-invalid={invalid("storyPoints")}
            aria-describedby={describedBy("storyPoints")}
          />
          <ShortBefore name="storyPoints" label="Story points" compare={compare} />
          <FieldError id="storyPoints-error" message={errors.storyPoints} />
        </div>
        {showStatus && (
          <div>
            <label id="status-label" htmlFor="status" className="label">
              Status
            </label>
            <input
              id="status"
              name="status"
              list="status-options"
              defaultValue={defaults.status}
              className="field mt-1 w-40"
              placeholder="To Do"
              aria-invalid={invalid("status")}
              aria-describedby={describedBy("status")}
            />
            <datalist id="status-options">
              <option value="To Do" />
              <option value="In Progress" />
              <option value="Done" />
            </datalist>
            <ShortBefore name="status" label="Status" compare={compare} />
            <FieldError id="status-error" message={errors.status} />
          </div>
        )}
      </div>
    </>
  );
}
