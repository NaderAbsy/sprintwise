"use client";
import { useSyncExternalStore } from "react";
import { localToday, parseDay, sprintStatus } from "@/lib/sprint/dates";

const noChange = () => () => {};
// The server only knows the UTC day. Hydration starts from that, then React re-renders with the browser's
// own day: suppressHydrationWarning alone would keep the server's text.
const utcDay = () => new Date().toISOString().slice(0, 10);

/**
 * "Day 3 of 14 · 11 days left", counted from the viewer's own date: in New Zealand's
 * morning the server's UTC day is still yesterday, which would say the sprint hasn't started.
 * `start` and `end` are YYYY-MM-DD. Empty once the sprint is over.
 */
export function SprintDay({ start, end, badge = false }: { start: string; end: string; badge?: boolean }) {
  const today = useSyncExternalStore(noChange, localToday, utcDay);
  const status = sprintStatus(parseDay(start)!, parseDay(end)!, parseDay(today)!);
  // Always a span, so the server's day and the browser's can differ without changing the page's shape.
  return (
    <span
      suppressHydrationWarning
      className={badge && status.running ? "rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted" : undefined}
    >
      {status.running ? (badge ? status.label : ` · ${status.label}`) : ""}
    </span>
  );
}
