"use client";
import { useState, useTransition } from "react";
import { setNightlySync } from "@/app/projects/actions";
import { attempt } from "@/lib/safe-action";

/** Turns the nightly Jira sync on or off; the label says what happens now. */
export function NightlySyncToggle({ projectId, on }: { projectId: string; on: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm">
        Nightly sync is <strong>{on ? "on" : "off"}</strong>.
      </p>
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await attempt(() => setNightlySync(projectId, !on));
            if (result && typeof result === "object" && "error" in result) setError(result.error);
          });
        }}
      >
        {pending ? "Saving…" : on ? "Turn off nightly sync" : "Turn on nightly sync"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-not-ready">
          {error}
        </p>
      )}
    </div>
  );
}
