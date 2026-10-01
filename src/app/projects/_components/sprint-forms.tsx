"use client";
import { useActionState, useRef, useState } from "react";
import { createSprint, lockBaseline, uploadSnapshot } from "@/app/projects/sprint-actions";
import { ChangeTable } from "@/components/change-table";
import { FieldError, FormAlert } from "@/components/form-feedback";
import { parseStoriesCsv, type CsvResult } from "@/lib/csv/parse";
import { MAX_BYTES } from "@/lib/csv/template";
import { emptyFormState } from "@/lib/form-state";
import { localToday } from "@/lib/sprint/dates";
import { diffSnapshots } from "@/lib/sprint/diff";
import type { Story } from "@/lib/stories/types";

const totalPoints = (stories: Story[]) => stories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);

export function CreateSprintForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(createSprint.bind(null, projectId), emptyFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="card max-w-lg space-y-4 p-5" noValidate>
      <div>
        <label htmlFor="sprint-name" className="label">
          Name
        </label>
        <input
          id="sprint-name"
          name="name"
          className="field mt-1"
          placeholder="e.g. Sprint 14"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby="sprint-name-error"
        />
        <FieldError id="sprint-name-error" message={errors.name} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="startDate" className="label">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            className="field mt-1"
            aria-invalid={errors.startDate ? true : undefined}
            aria-describedby="startDate-error"
          />
          <FieldError id="startDate-error" message={errors.startDate} />
        </div>
        <div>
          <label htmlFor="endDate" className="label">
            End date
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            className="field mt-1"
            aria-invalid={errors.endDate ? true : undefined}
            aria-describedby="endDate-error"
          />
          <FieldError id="endDate-error" message={errors.endDate} />
        </div>
      </div>
      <FormAlert state={state} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create sprint"}
      </button>
    </form>
  );
}

type UploadProps = {
  projectId: string;
  sprintId: string;
  /** "5 Oct 2026 to 16 Oct 2026" */
  rangeLabel: string;
  /** Last allowed "as of" day (the sprint end), as YYYY-MM-DD. */
  endDay: string;
  /** Earliest allowed "as of" day: the previous snapshot's, or the sprint start for the baseline. */
  minDay: string;
} & ({ mode: "baseline" } | { mode: "snapshot"; previous: Story[] });

/**
 * Baseline (S-2) and later snapshots (S-3) share one form. The file is read
 * and previewed in the browser; the server re-parses it before saving.
 */
export function SnapshotUploadForm(props: UploadProps) {
  const { projectId, sprintId, rangeLabel, endDay, minDay } = props;
  const serverAction = props.mode === "baseline" ? lockBaseline : uploadSnapshot;
  const [state, action, pending] = useActionState(serverAction.bind(null, projectId, sprintId), emptyFormState);
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<CsvResult | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const errors = state.fieldErrors ?? {};

  const today = localToday();
  const defaultDay = today < minDay ? minDay : today > endDay ? endDay : today;

  async function onFile(file: File | undefined) {
    setResult(null);
    setCsv("");
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setResult({ ok: false, errors: [{ message: "The file is larger than 1 MB." }] });
      return;
    }
    const text = await file.text();
    setCsv(text);
    setResult(parseStoriesCsv(text));
  }

  // After a successful save, clear the file so the same CSV isn't submitted twice.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.message) {
      setCsv("");
      setResult(null);
      setFileKey((k) => k + 1);
    }
  }

  const stories = result?.ok ? result.stories : [];
  const changes = result?.ok && props.mode === "snapshot" ? diffSnapshots(props.previous, stories) : [];
  const id = props.mode;

  return (
    <form ref={form} action={action} className="card space-y-4 p-5" noValidate>
      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor={`${id}-file`} className="label">
            {props.mode === "baseline" ? "Day-one CSV" : "Snapshot CSV"}
          </label>
          <input
            key={fileKey}
            id={`${id}-file`}
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-accent-foreground"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <input type="hidden" name="csv" value={csv} />
        </div>
        <div>
          <label htmlFor={`${id}-date`} className="label">
            As of
          </label>
          <input
            id={`${id}-date`}
            name="asOfDate"
            type="date"
            defaultValue={defaultDay}
            min={minDay}
            max={endDay}
            className="field mt-1"
            aria-invalid={errors.asOfDate ? true : undefined}
            aria-describedby={`${id}-date-error`}
          />
          <FieldError id={`${id}-date-error`} message={errors.asOfDate} />
        </div>
      </div>
      <p className="text-xs text-muted">
        The date the CSV was exported. It must be within the sprint ({rangeLabel}).
      </p>

      {result && !result.ok && (
        <div role="alert" className="rounded-md bg-not-ready-bg p-4 text-sm text-not-ready">
          <p className="font-medium">This file can&apos;t be used:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.errors.slice(0, 20).map((e, i) => (
              <li key={i}>{e.row ? `Row ${e.row}: ${e.message}` : e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {result?.ok && (
        <section aria-label="Preview" className="space-y-3">
          <p className="font-medium">
            {stories.length} {stories.length === 1 ? "story" : "stories"}, {totalPoints(stories)} points in total
          </p>
          {result.warnings.length > 0 && (
            <ul className="rounded-md bg-needs-work-bg p-3 text-sm text-needs-work">
              {result.warnings.map((w, i) => (
                <li key={i}>
                  Row {w.row}: {w.message}
                </li>
              ))}
            </ul>
          )}
          {props.mode === "snapshot" &&
            (changes.length === 0 ? (
              <p className="text-sm text-muted">Nothing changed since the previous snapshot.</p>
            ) : (
              <ChangeTable caption="Changes since the previous snapshot" rows={changes} />
            ))}
          {props.mode === "baseline" ? (
            <>
              <button type="button" className="btn-primary" onClick={() => dialog.current?.showModal()}>
                Lock as baseline
              </button>
              <dialog
                ref={dialog}
                aria-labelledby="lock-title"
                className="m-auto max-w-sm rounded-lg border border-border bg-surface p-6 text-foreground backdrop:bg-black/40"
              >
                <h2 id="lock-title" className="text-lg font-semibold">
                  Lock this baseline?
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {totalPoints(stories)} points across {stories.length} stories become the commitment every later
                  snapshot is measured against. Once locked it can&apos;t be edited or replaced; to redo it, delete the
                  sprint.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()} autoFocus>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={pending}
                    onClick={() => {
                      dialog.current?.close();
                      form.current?.requestSubmit();
                    }}
                  >
                    Lock baseline
                  </button>
                </div>
              </dialog>
            </>
          ) : (
            <button className="btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save snapshot"}
            </button>
          )}
        </section>
      )}
      <FormAlert state={state} />
    </form>
  );
}
