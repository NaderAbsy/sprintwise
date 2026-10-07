"use client";
import { Search } from "lucide-react";
import Form from "next/form";
import { useRef } from "react";

/** The status filter's value for stories with no status. */
export const NO_STATUS = "(none)";

/**
 * Search, status filter and sort for the backlog. A plain GET form, so the
 * view lives in the URL and works without JavaScript; with it, changing a
 * select applies at once.
 */
export function BacklogToolbar({
  action,
  q,
  status,
  sort,
  band,
  statuses,
  epic,
  epics,
  type,
  types,
  finished,
  edited = false,
  look = false,
}: {
  action: string;
  q: string;
  status: string;
  sort: "priority" | "weakest";
  band?: string;
  statuses: string[];
  epic: string;
  /** Epics named by imports; the filter appears only when there are some. */
  epics: string[];
  type: string;
  /** Issue types in the backlog; the filter appears only when imports named some. */
  types: string[];
  /** "show" while finished stories are shown, so searching keeps them. */
  finished: string;
  edited?: boolean;
  look?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  return (
    <Form ref={form} action={action} role="search" aria-label="Find stories" className="flex flex-wrap items-end gap-3">
      {band && <input type="hidden" name="band" value={band} />}
      {finished && <input type="hidden" name="finished" value={finished} />}
      {edited && <input type="hidden" name="edited" value="1" />}
      {look && <input type="hidden" name="look" value="1" />}
      <div className="min-w-48 flex-1">
        <label htmlFor="backlog-q" className="label">
          Search
        </label>
        <div className="relative mt-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input id="backlog-q" name="q" type="search" defaultValue={q} placeholder="Key or title" className="field pl-8" />
        </div>
      </div>
      <div>
        <label htmlFor="backlog-status" className="label">
          Status
        </label>
        <select id="backlog-status" name="status" defaultValue={status} onChange={submit} className="field mt-1 w-40">
          <option value="">Any status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === NO_STATUS ? "No status" : s}
            </option>
          ))}
        </select>
      </div>
      {epics.length > 0 && (
        <div>
          <label htmlFor="backlog-epic" className="label">
            Epic
          </label>
          <select id="backlog-epic" name="epic" defaultValue={epic} onChange={submit} className="field mt-1 w-48">
            <option value="">Any epic</option>
            {epics.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
      )}
      {types.length > 0 && (
        <div>
          <label htmlFor="backlog-type" className="label">
            Type
          </label>
          <select id="backlog-type" name="type" defaultValue={type} onChange={submit} className="field mt-1 w-36">
            <option value="">Any type</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="backlog-sort" className="label">
          Order
        </label>
        <select id="backlog-sort" name="sort" defaultValue={sort} onChange={submit} className="field mt-1 w-40">
          <option value="priority">Priority</option>
          <option value="weakest">Weakest first</option>
        </select>
      </div>
      <button className="btn-secondary">Apply</button>
    </Form>
  );
}
