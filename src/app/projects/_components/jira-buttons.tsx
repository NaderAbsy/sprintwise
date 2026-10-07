"use client";
import { RefreshCw, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { sendToJira, syncFromJira } from "@/app/projects/jira-actions";
import type { FormState } from "@/lib/form-state";

function Result({ state }: { state: FormState | null }) {
  if (!state?.message && !state?.error) return null;
  return (
    <p role="status" className={`w-full text-sm ${state.error ? "text-not-ready" : "text-ready"}`}>
      {state.error ?? state.message}
    </p>
  );
}

/** Writes stories edited here back to their Jira issues. */
export function SendToJiraButton({
  projectId,
  storyIds,
  label,
  className = "btn-primary btn-sm",
}: {
  projectId: string;
  storyIds: string[];
  label: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => startTransition(async () => setState(await sendToJira(projectId, storyIds)))}
      >
        <Send aria-hidden="true" className="h-3.5 w-3.5" />
        {pending ? "Sending…" : label}
      </button>
      <Result state={state} />
    </>
  );
}

/**
 * The backlog's Jira bar: Sync, Send the stories edited here, and one message
 * line that stays put while the list below refreshes.
 */
export function JiraBar({
  projectId,
  siteName,
  syncedAt,
  editedIds,
}: {
  projectId: string;
  siteName: string;
  syncedAt: string | null;
  editedIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"sync" | "send" | null>(null);
  const [state, setState] = useState<FormState | null>(null);
  const run = (kind: "sync" | "send") => {
    // Outside the transition, so "Syncing…" shows at once rather than when the work is done.
    setBusy(kind);
    startTransition(async () => {
      setState(kind === "sync" ? await syncFromJira(projectId) : await sendToJira(projectId, editedIds));
      setBusy(null);
    });
  };
  const toSend = Math.min(editedIds.length, 50);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
      <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => run("sync")}>
        <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${busy === "sync" ? "animate-spin" : ""}`} />
        {busy === "sync" ? "Syncing…" : "Sync from Jira"}
      </button>
      {toSend > 0 && (
        <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => run("send")}>
          <Send aria-hidden="true" className="h-3.5 w-3.5" />
          {busy === "send" ? "Sending…" : `Send ${toSend} to Jira`}
        </button>
      )}
      <span>
        From {siteName}
        {syncedAt ? `, last synced ${syncedAt}` : ""}.
      </span>
      <Result state={state} />
    </div>
  );
}
