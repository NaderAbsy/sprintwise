/**
 * Shown the moment a link is clicked, while the next page loads, so a click
 * always answers at once. Grey blocks stand in for a heading, a few cards and
 * a list; screen readers hear "Loading…".
 */
export function PageSkeleton({ heading = true }: { heading?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="animate-pulse space-y-6 motion-reduce:animate-none">
        {heading && (
          <div className="space-y-2">
            <div className="h-7 w-56 rounded-md bg-surface-2" />
            <div className="h-4 w-80 max-w-full rounded bg-surface-2" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-20" />
          ))}
        </div>
        <div className="card divide-y divide-border">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-surface-2" />
              <div className="h-4 flex-1 rounded bg-surface-2" />
              <div className="hidden h-4 w-20 rounded bg-surface-2 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
