"use client";
import { useActionState, useId, useMemo, useState } from "react";
import { importStories } from "@/app/projects/actions";
import { BandBadge } from "@/components/band-badge";
import { CsvFileInput } from "@/components/csv-file-input";
import { FormAlert } from "@/components/form-feedback";
import { matchColumns, readCsvTable, type CsvRow } from "@/lib/csv/parse";
import { readCsvFile } from "@/lib/csv/read";
import {
  IMPORT_FIELDS,
  IMPORT_FILE_BYTES,
  IMPORT_FILE_ROWS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_STORIES,
  type ColumnMapping,
  type ImportField,
} from "@/lib/csv/template";
import { emptyFormState } from "@/lib/form-state";
import { readySummary, scoreStory, type RuleSettings } from "@/lib/readiness/rules";
import { isDone } from "@/lib/sprint/metrics";

const NONE = "__none__";
const ALL = "__all__";
const count = (n: number) => `${n.toLocaleString("en")} ${n === 1 ? "story" : "stories"}`;

/**
 * Reads the file in the browser and lists every story with its score. The
 * person can match columns, filter, and tick what to bring in; only the ticked
 * stories are sent, and the server checks them again.
 */
export function ImportForm({
  projectId,
  settings,
  savedColumns,
  doneStatuses,
}: {
  projectId: string;
  settings: RuleSettings;
  /** The project's finished statuses: those stories start unticked, since they need no readiness check. */
  doneStatuses: string[];
  /** The columns picked at this project's last import. */
  savedColumns: ColumnMapping;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(importStories.bind(null, projectId), emptyFormState);
  const [text, setText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(savedColumns);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL);
  const [epic, setEpic] = useState(ALL);
  const [label, setLabel] = useState(ALL);

  const table = useMemo(
    () =>
      text === null
        ? null
        : readCsvTable(text, {
            mapping,
            maxBytes: IMPORT_FILE_BYTES,
            maxRows: IMPORT_FILE_ROWS,
            tooManyHint: " Narrow your Jira search before exporting, or split the file.",
          }),
    [text, mapping],
  );
  const rows = useMemo(
    () => (table?.ok ? table.rows.map((r) => ({ ...r, readiness: scoreStory(r.story, settings) })) : []),
    [table, settings],
  );

  async function onFile(file: File | undefined) {
    setText(null);
    setFileError(null);
    setQuery("");
    setStatus(ALL);
    setEpic(ALL);
    setLabel(ALL);
    setTicked(new Set());
    if (!file) return;
    if (file.size > IMPORT_FILE_BYTES) {
      setFileError(`The file is larger than ${IMPORT_FILE_BYTES / 1024 / 1024} MB.`);
      return;
    }
    const read = await readCsvFile(file);
    if (read.ok) setText(read.text);
    else setFileError(read.message);
  }

  // The first time a file reads cleanly (now, or once its columns are matched), tick every usable
  // story, unless there are more than one import takes.
  const [tickedFor, setTickedFor] = useState<string | null>(null);
  if (table?.ok && text !== null && tickedFor !== text) {
    setTickedFor(text);
    const ready = table.rows.filter((r) => r.errors.length === 0 && !isDone(r.story.status, doneStatuses));
    setTicked(ready.length <= IMPORT_MAX_STORIES ? new Set(ready.map((r) => r.row)) : new Set());
  }

  const usable = (r: CsvRow) => r.errors.length === 0;
  const lower = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (lower === "" || r.story.key.toLowerCase().includes(lower) || r.story.title.toLowerCase().includes(lower)) &&
      (status === ALL || r.story.status === status) &&
      (epic === ALL || r.epic === epic) &&
      (label === ALL || r.labels.includes(label)),
  );
  const options = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const statuses = options(rows.map((r) => r.story.status));
  const epics = options(rows.map((r) => r.epic));
  const labels = options(rows.flatMap((r) => r.labels));

  // A ticked row that a new column choice broke drops out of the count.
  const picked = rows.filter((r) => ticked.has(r.row) && usable(r));
  const shownUsable = shown.filter(usable);
  const allShownTicked = shownUsable.length > 0 && shownUsable.every((r) => ticked.has(r.row));
  const problems = rows.filter((r) => !usable(r));
  const finished = rows.filter((r) => usable(r) && isDone(r.story.status, doneStatuses));
  const noText = table?.ok
    ? [table.columns.description === null && "Description", table.columns.acceptance_criteria === null && "Acceptance criteria"].filter(
        (c): c is string => Boolean(c),
      )
    : [];
  const filtered = shown.length !== rows.length;
  const tooMany = picked.length > IMPORT_MAX_STORIES;

  const setShown = (on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      for (const r of shownUsable) {
        if (on) next.add(r.row);
        else next.delete(r.row);
      }
      return next;
    });

  const payload = useMemo(
    () => JSON.stringify(rows.filter((r) => ticked.has(r.row) && r.errors.length === 0).map((r) => ({ ...r.story, epic: r.epic }))),
    [rows, ticked],
  );
  // The server takes up to 4 MB per request; very long descriptions can pass that before 500 stories.
  const tooBig = useMemo(() => new TextEncoder().encode(payload).length > IMPORT_MAX_BYTES, [payload]);
  const headers = table?.headers ?? [];
  const showMatcher = table !== null && headers.length > 0 && (!table.ok ? table.missing.length > 0 : true);

  return (
    <form action={action} className="space-y-5">
      <div className="card p-5">
        <label htmlFor={`${id}-file`} className="label">
          CSV file
        </label>
        <CsvFileInput id={`${id}-file`} onFile={onFile} />
        <input type="hidden" name="stories" value={payload} />
        <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
        <p className="mt-2 text-xs text-muted">
          The file is read on your computer. Only the stories you tick are sent to Sprintwise.
        </p>
      </div>

      {(fileError || (table && !table.ok)) && (
        <div role="alert" className="rounded-lg bg-not-ready-bg p-4 text-sm text-not-ready">
          <p className="font-medium">This file can&apos;t be imported yet:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {fileError ? <li>{fileError}</li> : table && !table.ok && table.errors.map((e, i) => <li key={i}>{e.message}</li>)}
          </ul>
          {showMatcher && <p className="mt-2">Pick the right columns below and the stories will appear.</p>}
        </div>
      )}

      {showMatcher && table && (
        <ColumnMatcher
          headers={headers}
          mapping={mapping}
          onChange={setMapping}
          open={!table.ok}
        />
      )}

      {table?.ok && (
        <section aria-labelledby={`${id}-preview`} className="space-y-3">
          <h2 id={`${id}-preview`} className="font-medium">
            {count(rows.length)} in the file
            {problems.length > 0 && <span className="font-normal text-not-ready"> · {problems.length} can&apos;t be imported</span>}
          </h2>

          {noText.length > 0 && (
            <div className="rounded-lg bg-needs-work-bg p-4 text-sm text-needs-work">
              <p className="font-medium">
                No {noText.join(" or ")} column, so every story will score low.
              </p>
              <p className="mt-1">
                The score reads the story text: who wants what and why, and how you&apos;ll know it&apos;s done. Pick the
                column under Match columns, or show it in Jira&apos;s list view and export again. If your team writes
                acceptance criteria inside the description, a Description column is enough.
              </p>
            </div>
          )}

          <div role="group" aria-label="Filter the stories" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor={`${id}-q`} className="label">
                Search
              </label>
              <input
                id={`${id}-q`}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Key or title"
                className="field mt-1"
              />
            </div>
            <Filter id={`${id}-status`} label="Status" value={status} onChange={setStatus} values={statuses} />
            {epics.length > 0 && <Filter id={`${id}-epic`} label="Epic" value={epic} onChange={setEpic} values={epics} />}
            {labels.length > 0 && <Filter id={`${id}-label`} label="Label" value={label} onChange={setLabel} values={labels} />}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <p role="status" className="text-muted">
              {filtered ? `Showing ${shown.length.toLocaleString("en")} of ${rows.length.toLocaleString("en")}. ` : ""}
              <span className="font-medium text-foreground">{count(picked.length)} ticked</span>
              {picked.length > 0 && ` · ${readySummary(picked.map((p) => p.readiness))}`}
            </p>
            {finished.length > 0 && (
              <p className="w-full text-muted">
                {count(finished.length)} already finished ({[...new Set(finished.map((r) => r.story.status))].join(", ")}) left
                unticked: finished work needs no readiness check.
              </p>
            )}
            {filtered && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setTicked(new Set(shownUsable.map((r) => r.row)))}
              >
                Tick only these {shownUsable.length}
              </button>
            )}
            {ticked.size > 0 && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setTicked(new Set())}>
                Untick all
              </button>
            )}
          </div>

          <div className="card max-h-[32rem] overflow-auto">
            <table className="data-table">
              <caption className="sr-only">Stories in the file. Tick the ones to import.</caption>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th scope="col" className="w-10 pr-0! sm:pr-4!">
                    <input
                      type="checkbox"
                      aria-label={filtered ? "Tick all stories shown" : "Tick all stories"}
                      checked={allShownTicked}
                      disabled={shownUsable.length === 0}
                      ref={(el) => {
                        if (el) el.indeterminate = !allShownTicked && shownUsable.some((r) => ticked.has(r.row));
                      }}
                      onChange={() => setShown(!allShownTicked)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </th>
                  <th scope="col">Story</th>
                  {epics.length > 0 && (
                    <th scope="col" className="hidden md:table-cell">
                      Epic
                    </th>
                  )}
                  <th scope="col" className="hidden sm:table-cell">
                    Status
                  </th>
                  <th scope="col" className="hidden text-right sm:table-cell">
                    Points
                  </th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.row} className={usable(r) ? undefined : "bg-not-ready-bg/40"}>
                    <td className="pr-0! sm:pr-4!">
                      <input
                        type="checkbox"
                        aria-label={`Import ${r.story.key || `row ${r.row}`}`}
                        aria-describedby={usable(r) ? undefined : `${id}-row-${r.row}`}
                        checked={usable(r) && ticked.has(r.row)}
                        disabled={!usable(r)}
                        onChange={() =>
                          setTicked((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.row)) next.delete(r.row);
                            else next.add(r.row);
                            return next;
                          })
                        }
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                    </td>
                    <td>
                      <span className="font-mono text-xs text-subtle">{r.story.key || `Row ${r.row}`}</span>{" "}
                      <span className="font-medium">{r.story.title}</span>
                      {!usable(r) && (
                        <p id={`${id}-row-${r.row}`} className="mt-1 text-xs text-not-ready">
                          Row {r.row}: {r.errors.join(" ")}
                        </p>
                      )}
                      {usable(r) && r.warnings.length > 0 && (
                        <p className="mt-1 text-xs text-needs-work">{r.warnings.join(" ")}</p>
                      )}
                    </td>
                    {epics.length > 0 && <td className="hidden text-sm text-muted md:table-cell">{r.epic}</td>}
                    <td className="hidden text-sm whitespace-nowrap text-muted sm:table-cell">{r.story.status}</td>
                    <td className="hidden text-right tabular-nums sm:table-cell">{r.story.storyPoints ?? "—"}</td>
                    <td className="whitespace-nowrap">
                      <span className="mr-2 tabular-nums">{r.readiness.score}</span>
                      <span className="hidden sm:inline">
                        <BandBadge band={r.readiness.band} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">No stories match the filters.</p>}
          </div>

          {tooMany && (
            <p role="alert" className="text-sm text-not-ready">
              Up to {IMPORT_MAX_STORIES} stories go in one import. Untick {picked.length - IMPORT_MAX_STORIES}, or filter and
              import in parts.
            </p>
          )}
          {!tooMany && tooBig && (
            <p role="alert" className="text-sm text-not-ready">
              These stories hold too much text to send at once. Untick some, or filter and import in parts.
            </p>
          )}
          <button className="btn-primary" disabled={pending || picked.length === 0 || tooMany || tooBig}>
            {pending ? "Importing…" : picked.length === 0 ? "Tick stories to import" : `Import ${count(picked.length)}`}
          </button>
        </section>
      )}
      <FormAlert state={state} />
    </form>
  );
}

function Filter({
  id,
  label,
  value,
  onChange,
  values,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  values: string[];
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="field mt-1">
        <option value={ALL}>All</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}

/** One drop-down per field, listing the file's columns; open when the key or title couldn't be found. */
function ColumnMatcher({
  headers,
  mapping,
  onChange,
  open,
}: {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  open: boolean;
}) {
  const id = useId();
  const columns = matchColumns(headers, mapping);
  const names = [...new Set(headers.filter(Boolean))];
  const summary = IMPORT_FIELDS.filter((f) => columns[f.field] !== null)
    .map((f) => `${f.label} ← ${headers[columns[f.field]!]}`)
    .join(", ");
  const set = (field: ImportField, value: string) => onChange({ ...mapping, [field]: value === NONE ? null : value });

  return (
    <details open={open} className="card group p-5">
      <summary className="cursor-pointer text-sm">
        <span className="font-medium">Match columns</span>
        <span className="ml-2 text-muted">{summary || "No columns matched yet."}</span>
      </summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {IMPORT_FIELDS.map((f) => {
          const index = columns[f.field];
          return (
            <div key={f.field}>
              <label htmlFor={`${id}-${f.field}`} className="label">
                {f.label} column
                {"required" in f && f.required && <span className="text-not-ready"> (required)</span>}
              </label>
              <select
                id={`${id}-${f.field}`}
                value={index === null ? NONE : headers[index]}
                onChange={(e) => set(f.field, e.target.value)}
                className="field mt-1"
              >
                <option value={NONE}>— Not in this file —</option>
                {names.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>Your choices are remembered for this project&apos;s next import.</span>
        {Object.keys(mapping).length > 0 && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange({})}>
            Match by column names again
          </button>
        )}
      </div>
    </details>
  );
}
