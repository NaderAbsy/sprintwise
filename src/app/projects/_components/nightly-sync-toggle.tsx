"use client";
import { useTransition } from "react";
import { setNightlySync } from "@/app/projects/actions";

/** Turns the nightly Jira sync on or off; the label says what happens now. */
export function NightlySyncToggle({ projectId, on }: { projectId: string; on: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm">
        Nightly sync is <strong>{on ? "on" : "off"}</strong>.
      </p>
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={pending}
        onClick={() => startTransition(() => setNightlySync(projectId, !on))}
      >
        {pending ? "Saving…" : on ? "Turn off nightly sync" : "Turn on nightly sync"}
      </button>
    </div>
  );
}
