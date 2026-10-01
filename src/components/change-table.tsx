import type { Change, ChangeType } from "@/lib/sprint/diff";

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

/** The change log: one row per change, with its effect on the sprint's points. */
export function ChangeTable({ caption, rows }: { caption: string; rows: (Change & { date?: string })[] }) {
  const dated = rows.some((r) => r.date);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border text-left text-muted">
          <tr>
            {dated && <th scope="col" className="px-3 py-2 font-medium">Date</th>}
            <th scope="col" className="px-3 py-2 font-medium">Story</th>
            <th scope="col" className="px-3 py-2 font-medium">Change</th>
            <th scope="col" className="px-3 py-2 font-medium">Detail</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((change, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {dated && <td className="whitespace-nowrap px-3 py-1.5">{change.date}</td>}
              <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">{change.key}</td>
              <td className="whitespace-nowrap px-3 py-1.5">{LABELS[change.type]}</td>
              <td className="px-3 py-1.5 text-muted">{describe(change)}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${change.pointsDelta === 0 ? "text-muted" : ""}`}>
                {delta(change.pointsDelta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
