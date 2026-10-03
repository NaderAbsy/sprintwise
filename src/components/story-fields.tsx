import { FieldError } from "@/components/form-feedback";

export type StoryDefaults = {
  title?: string;
  description?: string;
  acceptanceCriteria?: string;
  storyPoints?: number | null;
  status?: string;
};

/** The story inputs shared by the project forms and the demo. Uncontrolled, so `defaults` fill them once. */
export function StoryFields({
  errors = {},
  showKey = false,
  showStatus = showKey,
  defaults = {},
}: {
  errors?: Record<string, string>;
  showKey?: boolean;
  showStatus?: boolean;
  defaults?: StoryDefaults;
}) {
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
        <input
          id="title"
          name="title"
          defaultValue={defaults.title}
          className="field mt-1"
          aria-invalid={invalid("title")}
          aria-describedby="title-error"
        />
        <FieldError id="title-error" message={errors.title} />
      </div>
      <div>
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults.description}
          className="field mt-1"
          placeholder="As a … I want … so that …"
          aria-invalid={invalid("description")}
          aria-describedby="description-error"
        />
        <FieldError id="description-error" message={errors.description} />
      </div>
      <div>
        <label htmlFor="acceptanceCriteria" className="label">
          Acceptance criteria <span className="font-normal text-muted">(one per line)</span>
        </label>
        <textarea
          id="acceptanceCriteria"
          name="acceptanceCriteria"
          rows={4}
          defaultValue={defaults.acceptanceCriteria}
          className="field mt-1 font-mono text-xs"
          placeholder={"- The customer gets an email within 1 minute\n- The refund shows on the order page"}
          aria-invalid={invalid("acceptanceCriteria")}
          aria-describedby="acceptanceCriteria-error"
        />
        <FieldError id="acceptanceCriteria-error" message={errors.acceptanceCriteria} />
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
            defaultValue={defaults.storyPoints ?? undefined}
            className="field mt-1 w-28"
            aria-invalid={invalid("storyPoints")}
            aria-describedby="storyPoints-error"
          />
          <FieldError id="storyPoints-error" message={errors.storyPoints} />
        </div>
        {showStatus && (
          <div>
            <label htmlFor="status" className="label">
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
              aria-describedby="status-error"
            />
            <datalist id="status-options">
              <option value="To Do" />
              <option value="In Progress" />
              <option value="Done" />
            </datalist>
            <FieldError id="status-error" message={errors.status} />
          </div>
        )}
      </div>
    </>
  );
}
