"use client";
import { attempt } from "@/lib/safe-action";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { bulkDeleteStories, bulkSetStatus, moveStory } from "@/app/projects/actions";
import { QuickField } from "@/app/projects/_components/quick-field";
import { BandBadge } from "@/components/band-badge";
import { ConfirmButton } from "@/components/confirm-button";
import { ScoreRing } from "@/components/score-ring";
import { useLeaveWarning } from "@/components/use-leave-warning";
import type { Band } from "@/lib/readiness/rules";

/**
 * On a phone the table is too narrow for a title beside a status list (titles broke mid-word), so each row
 * becomes a small grid: tick box and score on the left, the title with its status and move buttons under it.
 * The roles are written out because a table laid out as blocks otherwise stops being read out as one.
 */
const PHONE_ROW = "max-sm:grid max-sm:grid-cols-[2.25rem_3.25rem_minmax(0,1fr)]";

/** The position of the row an event happened in, from its data-index. */
function rowIndex(target: EventTarget): number | null {
  const row = target instanceof Element ? target.closest("tr") : null;
  const index = row ? Number(row.dataset.index) : NaN;
  return Number.isNaN(index) ? null : index;
}

export type BacklogRow = {
  id: string;
  key: string;
  title: string;
  epic: string;
  issueType: string;
  /** Edited in Sprintwise and not yet marked as copied to Jira. */
  edited: boolean;
  /** Shows signs of a pasted AI draft (not scored). */
  secondLook: boolean;
  status: string;
  storyPoints: number | null;
  score: number | null;
  band: Band | null;
  /** Why a score of 80+ isn't Ready, such as "Too big"; null otherwise. */
  capNote: string | null;
};

/**
 * The backlog list: tick stories to change several at once, edit status and
 * points in place, and (in priority order with no filters) drag a story by its
 * handle, or focus the handle and press the arrow keys, to change its priority.
 */
export function BacklogTable({
  projectId,
  rows: initialRows,
  reorderable,
  withFinished = true,
  caption,
  statusListId,
  statusOptions,
}: {
  projectId: string;
  rows: BacklogRow[];
  reorderable: boolean;
  /** Whether finished stories are in the list, so a new position counts the same rows the server does. */
  withFinished?: boolean;
  caption: string;
  /** The id of the <datalist> the bulk status box suggests from. */
  statusListId: string;
  /** The statuses each story's status can be set to. */
  statusOptions: string[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // The story being dragged. A ref as well as state: drop can fire before React re-renders after dragover.
  const [armed, setArmed] = useState<string | null>(null);
  const dragging = useRef<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkMessage, setBulkMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [moving, startMove] = useTransition();
  const [moved, setMoved] = useState(false);
  useLeaveWarning(moving, "Leave now? The new order is still being saved.");

  // New rows from the server (after a save elsewhere) replace the local copy.
  const [source, setSource] = useState(initialRows);
  if (source !== initialRows) {
    setSource(initialRows);
    setRows(initialRows);
    setSelected((prev) => new Set([...prev].filter((id) => initialRows.some((r) => r.id === id))));
  }

  const move = (id: string, to: number) => {
    const from = rows.findIndex((r) => r.id === id);
    const target = Math.max(0, Math.min(to, rows.length - 1));
    if (from < 0 || from === target) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(target, 0, row);
    const before = rows;
    setRows(next);
    setAnnouncement(`${row.key} moved to position ${target + 1} of ${rows.length}.`);
    setMoved(true);
    startMove(async () => {
      const result = await attempt(() => moveStory(projectId, id, target, withFinished));
      // Not saved: put the row back, so the screen never shows an order that isn't stored.
      if (result && typeof result === "object" && "error" in result) {
        setRows(before);
        setAnnouncement(`Couldn't save the new position of ${row.key}. Check your connection, then try again.`);
      }
    });
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const ids = [...selected];

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {selected.size > 0 && (
        <div role="region" aria-label="Change selected stories" className="card flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <span className="font-medium">
            {selected.size} {selected.size === 1 ? "story" : "stories"} selected
          </span>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await attempt(() => bulkSetStatus(projectId, ids, bulkStatus));
                setBulkMessage(result.error ? { text: result.error, error: true } : { text: result.message ?? "" });
              });
            }}
          >
            <label htmlFor="bulk-status" className="sr-only">
              New status for the selected stories
            </label>
            <input
              id="bulk-status"
              list={statusListId}
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              placeholder="New status"
              className="field h-8 w-36 px-2 py-1 text-sm"
            />
            <button className="btn-secondary btn-sm" disabled={pending}>
              {pending ? "Saving…" : "Set status"}
            </button>
          </form>
          <ConfirmButton
            label="Delete"
            title={`Delete ${selected.size} ${selected.size === 1 ? "story" : "stories"}?`}
            body="This removes them and their scores from the backlog. Sprints that already include them keep their own copies."
            confirmLabel="Delete stories"
            action={async () => {
              await bulkDeleteStories(projectId, ids);
              setSelected(new Set());
              setBulkMessage({ text: `Deleted ${ids.length} ${ids.length === 1 ? "story" : "stories"}.` });
            }}
          />
          <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
          {bulkMessage && (
            <p role="status" className={bulkMessage.error ? "text-not-ready" : "text-ready"}>
              {bulkMessage.text}
            </p>
          )}
        </div>
      )}
      {selected.size === 0 && bulkMessage && (
        <p role="status" className="text-sm text-ready">
          {bulkMessage.text}
        </p>
      )}

      <div className="card overflow-x-auto">
        <table role="table" className="data-table max-sm:block">
          <caption className="sr-only">{caption}</caption>
          <thead role="rowgroup" className="max-sm:block">
            <tr role="row" className={PHONE_ROW}>
              <th role="columnheader" scope="col" className="w-10 pr-0! sm:pr-4!">
                <input
                  type="checkbox"
                  aria-label="Select all stories shown"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selected.size > 0 && !allSelected;
                  }}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </th>
              {reorderable && (
                <th role="columnheader" scope="col" className="hidden w-10 sm:table-cell">
                  <span className="sr-only">Priority</span>
                </th>
              )}
              <th role="columnheader" scope="col" className="w-16 pl-2! pr-2! sm:px-4!">Score</th>
              <th role="columnheader" scope="col">Story</th>
              {/* On phones the band and points are written under the title (points are edited on the story), and the status sits under them. */}
              <th role="columnheader" scope="col" className="hidden w-32 sm:table-cell">Band</th>
              <th role="columnheader" scope="col" className="w-40 pr-2! max-sm:sr-only sm:pr-4!">Status</th>
              <th role="columnheader" scope="col" className="hidden w-24 sm:table-cell">Points</th>
            </tr>
          </thead>
          <tbody
            role="rowgroup"
            className="max-sm:block"
            onDragOver={(event) => {
              if (!dragging.current) return;
              event.preventDefault();
              const index = rowIndex(event.target);
              if (index !== null) setDropAt(index);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const index = rowIndex(event.target);
              if (dragging.current && index !== null) move(dragging.current, index);
              dragging.current = null;
              setArmed(null);
              setDropAt(null);
            }}
          >
            {rows.map((row, i) => (
              <tr
                key={row.id}
                role="row"
                data-index={i}
                className={`${PHONE_ROW}${dropAt === i && armed && armed !== row.id ? " outline-2 -outline-offset-2 outline-accent" : ""}`}
              >
                <td role="cell" className="pr-0! max-sm:row-span-2 sm:pr-4!">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.key}`}
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </td>
                {reorderable && (
                  <td role="cell" className="hidden sm:table-cell">
                    <button
                      type="button"
                      aria-label={`Move ${row.key}, priority ${i + 1} of ${rows.length}`}
                      aria-describedby="reorder-help"
                      className="grid h-7 w-7 cursor-grab place-items-center rounded text-subtle hover:bg-surface-2 hover:text-foreground active:cursor-grabbing"
                      // Only the handle drags, so text in the row's fields can still be selected.
                      draggable
                      onDragStart={(event) => {
                        dragging.current = row.id;
                        setArmed(row.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", row.key);
                        const tr = event.currentTarget.closest("tr");
                        if (tr) event.dataTransfer.setDragImage(tr, 24, tr.offsetHeight / 2);
                      }}
                      onDragEnd={() => {
                        dragging.current = null;
                        setArmed(null);
                        setDropAt(null);
                      }}
                      onKeyDown={(event) => {
                        const to = { ArrowUp: i - 1, ArrowDown: i + 1, Home: 0, End: rows.length - 1 }[event.key];
                        if (to === undefined) return;
                        event.preventDefault();
                        move(row.id, to);
                        // Keep focus on the handle as its row moves.
                        requestAnimationFrame(() =>
                          document.querySelector<HTMLButtonElement>(`[data-handle="${row.id}"]`)?.focus(),
                        );
                      }}
                      data-handle={row.id}
                    >
                      <GripVertical aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </td>
                )}
                <td role="cell" className="pl-2! pr-2! max-sm:row-span-2 sm:px-4!">{row.score !== null && row.band && <ScoreRing score={row.score} band={row.band} size="sm" />}</td>
                <td role="cell" className="max-sm:col-start-3 max-sm:border-b-0! max-sm:pb-1! max-sm:pl-2!">
                  <Link href={`/projects/${projectId}/stories/${row.id}`} className="group block">
                    <span className="font-mono text-xs text-subtle">{row.key}</span>{" "}
                    <span className="font-medium group-hover:text-accent group-hover:underline">{row.title}</span>
                  </Link>
                  {/* Phones hide the Band column: the ring's colour alone can't tell a held-back 85 from a Ready one. */}
                  {row.band && (
                    <span className="mt-0.5 block text-xs text-muted sm:hidden">
                      {row.band}
                      {row.capNote && ` · ${row.capNote}`}
                      {row.storyPoints !== null && ` · ${row.storyPoints} ${row.storyPoints === 1 ? "pt" : "pts"}`}
                    </span>
                  )}
                  {(row.epic || row.edited || row.secondLook || (row.issueType && row.issueType.toLowerCase() !== "story")) && (
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      {row.issueType && row.issueType.toLowerCase() !== "story" && (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium text-foreground">{row.issueType}</span>
                      )}
                      {row.epic && <span>{row.epic}</span>}
                      {row.edited && <span className="font-medium text-accent">Edited here</span>}
                      {row.secondLook && <span className="font-medium text-needs-work">Second look</span>}
                    </span>
                  )}
                </td>
                <td role="cell" className="hidden sm:table-cell">
                  {row.band && <BandBadge band={row.band} />}
                  {row.capNote && <span className="mt-1 block text-xs text-subtle">{row.capNote}</span>}
                </td>
                <td role="cell" className="pr-2! max-sm:col-start-3 max-sm:flex max-sm:items-center max-sm:gap-2 max-sm:pt-0! max-sm:pl-2! sm:pr-4!">
                  <QuickField
                    projectId={projectId}
                    storyId={row.id}
                    storyKey={row.key}
                    field="status"
                    value={row.status}
                    options={statusOptions}
                  />
                  {/* Phones have no drag handle (a touch scrolls the page), so priority moves one step at a time. */}
                  {reorderable && (
                    <span className="flex gap-1 sm:hidden">
                      <button
                        type="button"
                        aria-label={`Move ${row.key} up`}
                        // Not `disabled`: that drops keyboard focus to the top of the page the moment a story reaches the end.
                        aria-disabled={i === 0}
                        onClick={() => i > 0 && move(row.id, i - 1)}
                        className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted hover:bg-surface-2 hover:text-foreground aria-disabled:opacity-40"
                      >
                        <ChevronUp aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${row.key} down`}
                        aria-disabled={i === rows.length - 1}
                        onClick={() => i < rows.length - 1 && move(row.id, i + 1)}
                        className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted hover:bg-surface-2 hover:text-foreground aria-disabled:opacity-40"
                      >
                        <ChevronDown aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </td>
                <td role="cell" className="hidden sm:table-cell">
                  <QuickField
                    projectId={projectId}
                    storyId={row.id}
                    storyKey={row.key}
                    field="storyPoints"
                    value={row.storyPoints === null ? "" : String(row.storyPoints)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-muted">No stories match.</p>}
      </div>
      {reorderable && (
        <p className="text-xs text-muted">
          <span className="sm:hidden">Use the arrows under a story to move it up or down in priority.</span>
          <span id="reorder-help" className="hidden sm:inline">
            Drag a story by its handle to change its priority, or focus the handle and use the arrow keys (Home and End
            move it to the top or bottom).
          </span>{" "}
          {moved && <span className="font-medium text-foreground">{moving ? "Saving the new order…" : "Order saved."}</span>}
        </p>
      )}
    </div>
  );
}
