"use client";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { disableReportShare, enableReportShare } from "@/app/projects/sprint-actions";

/** Owner-only control: create, copy or turn off the read-only report link. */
export function ShareReport({ projectId, sprintId, token }: { projectId: string; sprintId: string; token: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  // The origin is only known in the browser; the server renders without it.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const url = token ? `${origin}/share/${token}` : "";

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => dialog.current?.showModal()}>
        <Share2 aria-hidden="true" className="h-4 w-4" />
        {token ? "Shared" : "Share"}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="share-title"
        className="m-auto w-full max-w-md rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/50"
      >
        <h2 id="share-title" className="text-lg font-semibold">
          Share this report
        </h2>
        <p className="mt-2 text-sm text-muted">
          Anyone with the link can view this report, read-only, without an account. They can&apos;t see anything else in
          your project. You can turn the link off at any time.
        </p>
        {token ? (
          <div className="mt-4 space-y-3">
            <label htmlFor="share-url" className="label">
              Link
            </label>
            <div className="flex gap-2">
              <input id="share-url" readOnly value={url} className="field font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                className="btn-primary shrink-0"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex justify-between gap-3 pt-2">
              <button
                type="button"
                className="btn-danger"
                disabled={pending}
                onClick={() => startTransition(() => disableReportShare(projectId, sprintId))}
              >
                Turn off the link
              </button>
              <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()} autoFocus>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()} autoFocus>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={pending}
              onClick={() => startTransition(() => enableReportShare(projectId, sprintId))}
            >
              <Link2 aria-hidden="true" className="h-4 w-4" />
              {pending ? "Creating…" : "Create link"}
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
