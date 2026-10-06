"use client";
import { X } from "lucide-react";
import { useState } from "react";

/**
 * A CSV file picker. Once a file is chosen, a Remove button clears it (and
 * whatever the form read from it) so the person can start again.
 */
export function CsvFileInput({
  id,
  onFile,
  describedBy,
}: {
  id: string;
  /** Called with the chosen file, or with undefined when it's removed. */
  onFile: (file: File | undefined) => void;
  describedBy?: string;
}) {
  const [name, setName] = useState<string | null>(null);
  // A file input can't be emptied from code reliably, so a new key mounts a fresh one.
  const [key, setKey] = useState(0);

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        key={key}
        id={id}
        type="file"
        accept=".csv,text/csv"
        aria-describedby={describedBy}
        className="block w-full min-w-0 flex-1 rounded-lg border border-dashed border-border-strong bg-surface-2/50 p-3 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent-hover"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setName(file?.name ?? null);
          onFile(file);
        }}
      />
      {name && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          className="btn-ghost btn-sm shrink-0"
          onClick={() => {
            setName(null);
            setKey((k) => k + 1);
            onFile(undefined);
            // The old input is gone, so put focus on the new one.
            requestAnimationFrame(() => document.getElementById(id)?.focus());
          }}
        >
          <X aria-hidden="true" className="h-4 w-4" />
          Remove
        </button>
      )}
    </div>
  );
}
