"use client";
import { useState, useTransition, type ReactNode } from "react";
import { attempt } from "@/lib/safe-action";

/**
 * A button that runs one server action. If the action can't run (offline,
 * signed out), it says so next to the button instead of the page turning into
 * an error screen.
 */
export function ActionButton({ action, className, children }: { action: () => Promise<void>; className: string; children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        className={className}
        aria-disabled={pending || undefined}
        onClick={() => {
          if (pending) return;
          setError(null);
          startTransition(async () => {
            const result = await attempt(action);
            if (result && typeof result === "object" && "error" in result) setError(result.error);
          });
        }}
      >
        {children}
      </button>
      {error && (
        <span role="alert" className="text-xs text-not-ready">
          {error}
        </span>
      )}
    </span>
  );
}
