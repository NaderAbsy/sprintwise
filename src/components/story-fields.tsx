import { FieldError } from "@/components/form-feedback";

/** The story inputs shared by the project form and the demo. */
export function StoryFields({ errors = {}, showKey = false }: { errors?: Record<string, string>; showKey?: boolean }) {
  const invalid = (name: string) => (errors[name] ? true : undefined);
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
      <div>
        <label htmlFor="title" className="label">
          Title
        </label>
        <input id="title" name="title" className="field mt-1" aria-invalid={invalid("title")} aria-describedby="title-error" />
        <FieldError id="title-error" message={errors.title} />
      </div>
      <div>
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea id="description" name="description" rows={3} className="field mt-1" placeholder="As a … I want … so that …" />
      </div>
      <div>
        <label htmlFor="acceptanceCriteria" className="label">
          Acceptance criteria <span className="font-normal text-muted">(one per line)</span>
        </label>
        <textarea id="acceptanceCriteria" name="acceptanceCriteria" rows={4} className="field mt-1 font-mono text-xs" />
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="storyPoints" className="label">
            Story points
          </label>
          <input
            id="storyPoints"
            name="storyPoints"
            inputMode="decimal"
            className="field mt-1 w-28"
            aria-invalid={invalid("storyPoints")}
            aria-describedby="storyPoints-error"
          />
          <FieldError id="storyPoints-error" message={errors.storyPoints} />
        </div>
        {showKey && (
          <div>
            <label htmlFor="status" className="label">
              Status
            </label>
            <input id="status" name="status" className="field mt-1 w-40" placeholder="To Do" />
          </div>
        )}
      </div>
    </>
  );
}
