"use client";
import { useRef, useTransition } from "react";

/** A destructive action behind a confirmation dialog (native <dialog>: focus-trapped, Esc to close). */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  action,
}: {
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  action: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button type="button" className="btn-danger" onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="confirm-title"
        className="m-auto max-w-sm rounded-lg border border-border bg-surface p-6 text-foreground backdrop:bg-black/40"
      >
        <h2 id="confirm-title" className="text-lg font-semibold">
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
