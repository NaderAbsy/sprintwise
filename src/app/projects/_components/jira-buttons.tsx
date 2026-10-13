"use client";
import { attempt } from "@/lib/safe-action";
import { RefreshCw, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { sendToJira, syncFromJira } from "@/app/projects/jira-actions";
import type { FormState } from "@/lib/form-state";
import { ConnectJiraButton } from "@/app/projects/_components/connect-jira";
import { needsReconnect } from "@/lib/jira-messages";

function Result({ state }: { state: FormState | null }) {
  if (!state?.message && !state?.error) return null;
  const text = state.error ?? state.message;
  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <p role="status" className={`text-sm ${state.error ? "text-not-ready" : "text-ready"}`}>
        {text}
      </p>
      {needsReconnect(text) && <ConnectJiraButton label="Reconnect Jira" className="btn-secondary btn-sm" />}
    </div>
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
        onClick={() => startTransition(async () => setState(await attempt(() => sendToJira(projectId, storyIds))))}
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
  automatic = false,
  nightlyError = null,
  editedIds,
}: {
  projectId: string;
  siteName: string;
  syncedAt: string | null;
  /** Whether the last sync was the nightly one. */
  automatic?: boolean;
  /** Why last night's sync didn't run, until a sync works. */
  nightlyError?: string | null;
  editedIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"sync" | "send" | null>(null);
  const [state, setState] = useState<FormState | null>(null);
  const run = (kind: "sync" | "send") => {
    // Outside the transition, so "Syncing…" shows at once rather than when the work is done.
    setBusy(kind);
    startTransition(async () => {
      setState(await attempt(() => (kind === "sync" ? syncFromJira(projectId) : sendToJira(projectId, editedIds))));
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
        {syncedAt ? `, last synced ${syncedAt}${automatic ? " automatically" : ""}` : ""}.
      </span>
      {nightlyError && !state?.message && (
        <div className="flex w-full flex-wrap items-center gap-3">
          <p role="status" className="text-needs-work">
            Last night&apos;s sync didn&apos;t run: {nightlyError}
          </p>
          {needsReconnect(nightlyError) && <ConnectJiraButton label="Reconnect Jira" className="btn-secondary btn-sm" />}
        </div>
      )}
      <Result state={state} />
    </div>
  );
}
