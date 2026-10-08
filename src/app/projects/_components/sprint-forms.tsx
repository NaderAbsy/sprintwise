"use client";
import { useActionState, useRef, useState } from "react";
import { createSprint, lockBaseline, uploadSnapshot } from "@/app/projects/sprint-actions";
import { ChangeTable } from "@/components/change-table";
import { CsvFileInput } from "@/components/csv-file-input";
import { FieldError, FormAlert } from "@/components/form-feedback";
import { parseStoriesCsv, type CsvResult } from "@/lib/csv/parse";
import { readCsvFile } from "@/lib/csv/read";
import { MAX_BYTES } from "@/lib/csv/template";
import { emptyFormState } from "@/lib/form-state";
import { localToday } from "@/lib/sprint/dates";
import { diffSnapshots } from "@/lib/sprint/diff";
import { formatPoints } from "@/lib/sprint/metrics";
import type { Story } from "@/lib/stories/types";
import { BandBadge } from "@/components/band-badge";
import { scoreStory, type RuleSettings } from "@/lib/readiness/rules";
import { keepValuesOnSubmit } from "@/lib/keep-values-on-submit";

const totalPoints = (stories: Story[]) => stories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);

/** YYYY-MM-DD plus `days`, in UTC so it never shifts with the time zone. */
function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CreateSprintForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(createSprint.bind(null, projectId), emptyFormState);
  const errors = state.fieldErrors ?? {};
  // A two-week sprint starting today: the most common shape, easy to change.
  const today = localToday();
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="card max-w-lg space-y-4 p-5" noValidate>
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
            defaultValue={today}
            suppressHydrationWarning
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
            defaultValue={addDays(today, 13)}
            suppressHydrationWarning
            className="field mt-1"
            aria-invalid={errors.endDate ? true : undefined}
            aria-describedby="endDate-error"
          />
          <FieldError id="endDate-error" message={errors.endDate} />
        </div>
      </div>
      <div>
        <label htmlFor="sprint-goal" className="label">
          Sprint goal <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="sprint-goal"
          name="goal"
          rows={2}
          className="field mt-1"
          placeholder="e.g. Customers can rebook a past cleaner in two taps"
          aria-invalid={errors.goal ? true : undefined}
          aria-describedby="sprint-goal-error"
        />
        <FieldError id="sprint-goal-error" message={errors.goal} />
      </div>
      <FormAlert state={state} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create sprint"}
      </button>
    </form>
  );
}

export type BacklogStory = Story & { id: string };

type UploadProps = {
  projectId: string;
  sprintId: string;
  /** "5 Oct 2026 to 16 Oct 2026" */
  rangeLabel: string;
  /** Last allowed "as of" day (the sprint end), as YYYY-MM-DD. */
  endDay: string;
  /** Earliest allowed "as of" day: the previous snapshot's, or the sprint start for the baseline. */
  minDay: string;
  /** The project's backlog, so teams without Jira can pick stories instead of uploading a CSV. */
  backlog: BacklogStory[];
  /** The project's rules, to show each story's readiness while planning. */
  settings: RuleSettings;
} & (
  | { mode: "baseline"; capacity: { points: number; sprints: number; unplanned: number; unplannedBugs: number } | null }
  | { mode: "snapshot"; previous: Story[] }
);

type Source = "backlog" | "csv";

/**
 * Baseline (S-2) and later snapshots (S-3) share one form. Stories come from
 * the project's backlog or a CSV; a CSV is read and previewed in the browser,
 * and the server re-reads either source before saving.
 */
export function SnapshotUploadForm(props: UploadProps) {
  const { projectId, sprintId, rangeLabel, endDay, minDay, backlog, settings } = props;
  const serverAction = props.mode === "baseline" ? lockBaseline : uploadSnapshot;
  const [state, action, pending] = useActionState(serverAction.bind(null, projectId, sprintId), emptyFormState);
  const [source, setSource] = useState<Source>(backlog.length > 0 ? "backlog" : "csv");
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<CsvResult | null>(null);
  const [fileKey, setFileKey] = useState(0);
  // A later snapshot starts from the stories already in the sprint.
  const [picked, setPicked] = useState<Set<string>>(() => {
    if (props.mode !== "snapshot") return new Set();
    const keys = new Set(props.previous.map((s) => s.key));
    return new Set(backlog.filter((s) => keys.has(s.key)).map((s) => s.id));
  });
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
    const read = await readCsvFile(file);
    if (!read.ok) {
      setResult({ ok: false, errors: [{ message: read.message }] });
      return;
    }
    setCsv(read.text);
    setResult(parseStoriesCsv(read.text));
  }

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const stories =
    source === "backlog" ? backlog.filter((s) => picked.has(s.id)) : result?.ok ? result.stories : [];
  const hasStories = stories.length > 0 && (source === "backlog" || result?.ok === true);
  const changes = hasStories && props.mode === "snapshot" ? diffSnapshots(props.previous, stories) : [];
  const bandOf = (story: Story) => scoreStory(story, settings).band;
  const notReady = props.mode === "baseline" ? stories.filter((st) => bandOf(st) !== "Ready") : [];
  const capacity = props.mode === "baseline" ? props.capacity : null;
  const selectedPoints = totalPoints(stories);
  const overCapacity = capacity !== null && selectedPoints > capacity.points * 1.1;
  const id = props.mode;

  return (
    <form ref={form} action={action} onSubmit={keepValuesOnSubmit(action)} className="card space-y-5 p-5" noValidate>
      <fieldset>
        <legend className="label">Where are the stories?</legend>
        <div className="mt-2 inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
          {(
            [
              ["backlog", "From the backlog"],
              ["csv", "Upload a CSV"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-muted transition-colors has-checked:bg-surface has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-accent"
            >
              <input
                type="radio"
                name="source"
                value={value}
                checked={source === value}
                onChange={() => setSource(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {source === "backlog" ? (
        backlog.length === 0 ? (
          <p className="rounded-lg bg-surface-2 p-4 text-sm text-muted">
            This project&apos;s backlog is empty. Add or import stories first, or upload a CSV instead.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                {props.mode === "baseline"
                  ? "Tick the stories the team committed to."
                  : "Tick the stories in the sprint now. Their current status and points are saved with them."}
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost btn-sm" onClick={() => setPicked(new Set(backlog.map((s) => s.id)))}>
                  Select all
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setPicked(new Set())}>
                  Clear
                </button>
              </div>
            </div>
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {backlog.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2/50">
                    <input
                      type="checkbox"
                      name="storyId"
                      value={s.id}
                      checked={picked.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span className="w-20 shrink-0 font-mono text-xs text-subtle sm:w-24">{s.key}</span>
                    <span className="line-clamp-2 min-w-0 flex-1">{s.title}</span>
                    {props.mode === "baseline" ? (
                      <span className="hidden sm:inline">
                        <BandBadge band={bandOf(s)} />
                      </span>
                    ) : (
                      <span className="hidden text-xs text-muted sm:inline">{s.status || "No status"}</span>
                    )}
                    <span className="w-14 text-right text-xs tabular-nums text-muted">
                      {s.storyPoints === null ? "—" : formatPoints(s.storyPoints)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <div>
          <label htmlFor={`${id}-file`} className="label">
            {props.mode === "baseline" ? "Day-one CSV" : "Snapshot CSV"}
          </label>
          <CsvFileInput key={fileKey} id={`${id}-file`} onFile={onFile} />
          <input type="hidden" name="csv" value={csv} />
          <p className="mt-2 text-xs text-muted">
            Export the sprint from Jira, or use the{" "}
            <a href="/template.csv" className="text-accent underline underline-offset-2">
              Sprintwise template
            </a>
            .
          </p>
        </div>
      )}

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
          className="field mt-1 w-44"
          aria-invalid={errors.asOfDate ? true : undefined}
          aria-describedby={`${id}-date-error ${id}-date-hint`}
        />
        <FieldError id={`${id}-date-error`} message={errors.asOfDate} />
        <p id={`${id}-date-hint`} className="mt-1 text-xs text-muted">
          The day these stories describe. It must be within the sprint ({rangeLabel}).
        </p>
      </div>

      {source === "csv" && result && !result.ok && (
        <div role="alert" className="rounded-lg bg-not-ready-bg p-4 text-sm text-not-ready">
          <p className="font-medium">This file can&apos;t be used:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.errors.slice(0, 20).map((e, i) => (
              <li key={i}>{e.row ? `Row ${e.row}: ${e.message}` : e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {hasStories && (
        <section aria-label="Preview" className="space-y-3">
          <p className="font-medium">
            {stories.length} {stories.length === 1 ? "story" : "stories"}, {totalPoints(stories)} points in total
          </p>
          {source === "csv" && result?.ok && result.warnings.length > 0 && (
            <ul className="rounded-lg bg-needs-work-bg p-3 text-sm text-needs-work">
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
          {props.mode === "baseline" && (
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              {capacity ? (
                <>
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      Planned <strong className="tabular-nums">{selectedPoints}</strong> pts · the team usually finishes{" "}
                      <strong className="tabular-nums">{capacity.points}</strong> pts
                    </span>
                    <span className="text-xs text-muted">
                      Average of the last {capacity.sprints} {capacity.sprints === 1 ? "sprint" : "sprints"}
                    </span>
                  </div>
                  <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${overCapacity ? "bg-needs-work-dot" : "bg-accent"}`}
                      style={{ width: `${Math.min(100, (selectedPoints / Math.max(capacity.points, 1)) * 100)}%` }}
                    />
                  </div>
                  {capacity.unplanned > 0 && (
                    <p className="text-xs text-muted">
                      This already allows for about <span className="tabular-nums">{capacity.unplanned}</span> points a
                      sprint of unplanned work
                      {capacity.unplannedBugs > 0 && (
                        <>
                          {" "}
                          (<span className="tabular-nums">{capacity.unplannedBugs}</span> from bugs)
                        </>
                      )}
                      : velocity counts only planned work that got done, so no extra buffer is needed.
                    </p>
                  )}
                  {overCapacity && (
                    <p className="text-needs-work">
                      That&apos;s {Math.round((selectedPoints - capacity.points) * 10) / 10} points more than the team
                      usually finishes. Consider leaving something out.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted">
                  Once a sprint has a later snapshot, Sprintwise shows how many points the team usually finishes here.
                </p>
              )}
              {notReady.length > 0 ? (
                <p role="status" className="text-needs-work">
                  {notReady.length} of {stories.length} {stories.length === 1 ? "story" : "stories"}{" "}
                  {notReady.length === 1 ? "isn't" : "aren't"} Ready:{" "}
                  {notReady.map((st) => st.key).join(", ")}. Unready stories are the ones most likely to change
                  mid-sprint.
                </p>
              ) : (
                <p className="text-ready">Every chosen story is Ready.</p>
              )}
            </div>
          )}
          {props.mode === "baseline" ? (
            <>
              <button type="button" className="btn-primary" onClick={() => dialog.current?.showModal()}>
                Lock as baseline
              </button>
              <dialog
                ref={dialog}
                aria-labelledby="lock-title"
                className="m-auto max-w-sm rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/50"
              >
                <h2 id="lock-title" className="text-lg font-semibold">
                  Lock this baseline?
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {totalPoints(stories)} points across {stories.length} stories become the commitment every later
                  snapshot is measured against. Once locked it can&apos;t be edited. You can undo it until you save
                  the first later snapshot.
                </p>
                {(notReady.length > 0 || overCapacity) && (
                  <ul className="mt-3 list-disc space-y-1 rounded-lg bg-needs-work-bg py-2 pr-3 pl-7 text-sm text-needs-work">
                    {notReady.length > 0 && (
                      <li>
                        {notReady.length} {notReady.length === 1 ? "story isn't" : "stories aren't"} Ready yet.
                      </li>
                    )}
                    {overCapacity && capacity && <li>It&apos;s more than the {capacity.points} points the team usually finishes.</li>}
                  </ul>
                )}
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
