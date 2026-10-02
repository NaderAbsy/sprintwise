"use client";
import { useActionState } from "react";
import { updateRuleSettings } from "@/app/projects/actions";
import { FieldError, FormAlert } from "@/components/form-feedback";
import { emptyFormState } from "@/lib/form-state";

/** R-6: the max points and vague-word list that this project's rules use. */
export function RuleSettingsForm({
  projectId,
  maxPoints,
  vagueWords,
  isDefault,
}: {
  projectId: string;
  maxPoints: number;
  vagueWords: string[];
  isDefault: boolean;
}) {
  const [state, action, pending] = useActionState(updateRuleSettings.bind(null, projectId), emptyFormState);
  const errors = state.fieldErrors ?? {};
  return (
    // key: after a reset the inputs re-mount with the saved values.
    <form key={`${maxPoints}:${vagueWords.join("|")}`} action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="maxPoints" className="label">
          Max story points
        </label>
        <p id="maxPoints-help" className="mt-0.5 text-sm text-muted">
          Stories above this fail &ldquo;Small enough&rdquo; and can&apos;t be Ready until they&apos;re split.
        </p>
        <input
          id="maxPoints"
          name="maxPoints"
          inputMode="numeric"
          defaultValue={maxPoints}
          className="field mt-2 w-28"
          aria-invalid={errors.maxPoints ? true : undefined}
          aria-describedby="maxPoints-help maxPoints-error"
        />
        <FieldError id="maxPoints-error" message={errors.maxPoints} />
      </div>
      <div>
        <label htmlFor="vagueWords" className="label">
          Vague words
        </label>
        <p id="vagueWords-help" className="mt-0.5 text-sm text-muted">
          One per line. Matching ignores case and whole words only, so &ldquo;fast&rdquo; doesn&apos;t match
          &ldquo;breakfast&rdquo;.
        </p>
        <textarea
          id="vagueWords"
          name="vagueWords"
          rows={8}
          defaultValue={vagueWords.join("\n")}
          className="field mt-2 font-mono text-xs"
          aria-invalid={errors.vagueWords ? true : undefined}
          aria-describedby="vagueWords-help vagueWords-error"
        />
        <FieldError id="vagueWords-error" message={errors.vagueWords} />
      </div>
      <FormAlert state={state} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving and re-scoring…" : "Save and re-score"}
        </button>
        {!isDefault && (
          <button name="intent" value="reset" className="btn-secondary" disabled={pending}>
            Reset to defaults
          </button>
        )}
      </div>
    </form>
  );
}
