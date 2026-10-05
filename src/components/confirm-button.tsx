"use client";
import { useId, useRef, useTransition } from "react";

/** A destructive action behind a confirmation dialog (native <dialog>: focus-trapped, Esc to close). */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  action,
  tone = "danger",
}: {
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  action: () => Promise<void>;
  /** "quiet" for an undo that loses no stories: a plain trigger, same confirmation. */
  tone?: "danger" | "quiet";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button type="button" className={tone === "danger" ? "btn-danger" : "btn-secondary"} onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto max-w-sm rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/50"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() => startTransition(() => action())}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
