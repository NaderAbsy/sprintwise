"use client";
import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { updateCustomChecks } from "@/app/projects/actions";
import { FieldError, FormAlert } from "@/components/form-feedback";
import { emptyFormState } from "@/lib/form-state";
import type { CustomCheck } from "@/lib/readiness/rules";
import { SETTINGS_LIMITS } from "@/lib/readiness/settings";
import { keepValuesOnSubmit } from "@/lib/keep-values-on-submit";

type Row = CustomCheck & { uid: number };

const EXAMPLES: CustomCheck[] = [
  { name: "Has a design link", field: "any", phrase: "figma.com" },
  { name: "Names the analytics event", field: "criteria", phrase: "event:" },
];

/** The team's own Definition of Ready additions. Each one is pass/fail; a failure keeps a story from being Ready. */
export function CustomChecksForm({ projectId, checks }: { projectId: string; checks: CustomCheck[] }) {
  const [state, action, pending] = useActionState(updateCustomChecks.bind(null, projectId), emptyFormState);
  const [rows, setRows] = useState<Row[]>(() => checks.map((c, i) => ({ ...c, uid: i })));
  const [nextUid, setNextUid] = useState(checks.length);
  const errors = state.fieldErrors ?? {};

  const add = (check: CustomCheck = { name: "", field: "any", phrase: "" }) => {
    setRows((r) => [...r, { ...check, uid: nextUid }]);
    setNextUid((n) => n + 1);
  };

  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-4" noValidate>
      {rows.length === 0 ? (
        <div className="rounded-lg bg-surface-2 p-4 text-sm text-muted">
          <p>No team checks yet. For example:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex.name} type="button" className="btn-secondary btn-sm" onClick={() => add(ex)}>
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                {ex.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, i) => (
            <li key={row.uid} className="rounded-lg border border-border p-3">
              <fieldset className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end">
                <legend className="sr-only">Check {i + 1}</legend>
                <div>
                  <label htmlFor={`check-name-${row.uid}`} className="label">
                    Check name
                  </label>
                  <input
                    id={`check-name-${row.uid}`}
                    name="checkName"
                    defaultValue={row.name}
                    maxLength={SETTINGS_LIMITS.checkName}
                    placeholder="Has a design link"
                    className="field mt-1"
                    aria-describedby={`check-error-${i}`}
                  />
                </div>
                <div>
                  <label htmlFor={`check-field-${row.uid}`} className="label">
                    Look in
                  </label>
                  <select id={`check-field-${row.uid}`} name="checkField" defaultValue={row.field} className="field mt-1">
                    <option value="any">The whole story</option>
                    <option value="description">Title or description</option>
                    <option value="criteria">Acceptance criteria</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`check-phrase-${row.uid}`} className="label">
                    Must contain
                  </label>
                  <input
                    id={`check-phrase-${row.uid}`}
                    name="checkPhrase"
                    defaultValue={row.phrase}
                    maxLength={SETTINGS_LIMITS.phrase}
                    placeholder="figma.com"
                    className="field mt-1"
                  />
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setRows((r) => r.filter((x) => x.uid !== row.uid))}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  <span className="sr-only">Remove check {i + 1}</span>
                </button>
              </fieldset>
              <FieldError id={`check-error-${i}`} message={errors[`check-${i}`]} />
            </li>
          ))}
        </ul>
      )}
      <FieldError id="checks-error" message={errors.checks} />
      <FormAlert state={state} />
      <div className="flex flex-wrap gap-2">
        {rows.length < SETTINGS_LIMITS.checks && (
          <button type="button" className="btn-secondary" onClick={() => add()}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add a check
          </button>
        )}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving and re-scoring…" : "Save checks and re-score"}
        </button>
      </div>
    </form>
  );
}
