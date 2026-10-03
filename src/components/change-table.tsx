import type { Change, ChangeType } from "@/lib/sprint/diff";
import { reasonLabel } from "@/lib/sprint/reasons";
import { isScopeChange } from "@/lib/sprint/report";

const LABELS: Record<ChangeType, string> = {
  added: "Added",
  removed: "Removed",
  "re-estimated": "Re-estimated",
  "criteria-changed": "Criteria changed",
  "status-changed": "Status changed",
  renamed: "Renamed",
};

function describe(change: Change): string {
  switch (change.type) {
    case "added":
      return change.newValue === null ? "No points" : `${change.newValue} pts`;
    case "removed":
      return change.oldValue === null ? "No points" : `${change.oldValue} pts`;
    case "re-estimated":
      return `${change.oldValue ?? "none"} → ${change.newValue ?? "none"} pts`;
    case "status-changed":
      return `${change.oldValue || "blank"} → ${change.newValue || "blank"}`;
    case "renamed":
      return `“${change.oldValue}” → “${change.newValue}”`;
    case "criteria-changed":
      return "Acceptance criteria edited";
  }
}

function delta(points: number): string {
  if (points === 0) return "0";
  return points > 0 ? `+${points}` : `−${Math.abs(points)}`;
}

type Row = Change & { date?: string; id?: string; reason?: string | null };

/**
 * The change log: one row per change, with its effect on the sprint's points.
 * `reasons` adds a "Why" column: "text" shows the tag, or a function renders an editor for scope changes.
 */
export function ChangeTable({
  caption,
  rows,
  reasons,
}: {
  caption: string;
  rows: Row[];
  reasons?: "text" | ((row: Row) => React.ReactNode);
}) {
  const dated = rows.some((r) => r.date);
  // With an editable "Why" column, phones drop the date and detail so the picker stays on screen.
  const narrow = typeof reasons === "function" ? "hidden sm:table-cell" : "";
  return (
    // Focusable, so keyboard users can scroll it sideways on narrow screens.
    <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {dated && <th scope="col" className={narrow}>Date</th>}
            <th scope="col">Story</th>
            <th scope="col">Change</th>
            <th scope="col" className={narrow}>Detail</th>
            <th scope="col" className="text-right">Points</th>
            {reasons && <th scope="col">Why</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((change, i) => (
            <tr key={i}>
              {dated && <td className={`whitespace-nowrap ${narrow}`}>{change.date}</td>}
              <td className="whitespace-nowrap font-mono text-xs">{change.key}</td>
              <td className="whitespace-nowrap">{LABELS[change.type]}</td>
              <td className={`text-muted ${narrow}`}>{describe(change)}</td>
              <td className={`text-right tabular-nums ${change.pointsDelta === 0 ? "text-subtle" : "font-medium"}`}>
                {delta(change.pointsDelta)}
              </td>
              {reasons && (
                <td className="whitespace-nowrap">
                  {!isScopeChange(change) ? (
                    <span className="text-subtle">—</span>
                  ) : reasons === "text" ? (
                    <span className={change.reason ? "" : "text-subtle"}>{reasonLabel(change.reason)}</span>
                  ) : (
                    reasons(change)
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
