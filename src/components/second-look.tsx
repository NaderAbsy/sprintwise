import { Eye } from "lucide-react";
import type { SecondLook } from "@/lib/readiness/second-look";

/** "Worth a second look": signs of a pasted AI draft. Shown beside the score, never part of it. */
export function SecondLookList({ items, compact = false }: { items: SecondLook[]; compact?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="second-look" className={`rounded-lg bg-surface-2 text-sm ${compact ? "p-3" : "p-4"}`}>
      <h2 id="second-look" className="flex items-center gap-2 font-medium">
        <Eye aria-hidden="true" className="h-4 w-4 text-accent" />
        Worth a second look
      </h2>
      <p className="mt-1 text-xs text-muted">Signs of an AI draft pasted without a careful read. Not part of the score.</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-muted">
            {item.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
