"use client";
import { X } from "lucide-react";
import { useRef, useState } from "react";

const isCsv = (file: File) => file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

/**
 * A CSV file picker that also takes a file dragged onto it. Once a file is
 * chosen, a Remove button clears it (and whatever the form read from it) so the
 * person can start again.
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
  const [over, setOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const hintId = `${id}-drop-hint`;

  const choose = (file: File | undefined) => {
    setDropError(null);
    setName(file?.name ?? null);
    onFile(file);
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div
          className={`min-w-0 flex-1 rounded-lg border p-3 transition-colors ${
            over ? "border-solid border-accent bg-accent/15 ring-2 ring-accent/30" : "border-dashed border-border-strong bg-surface-2/50"
          }`}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setOver(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            const file = event.dataTransfer.files[0];
            if (!file) return;
            if (!isCsv(file)) {
              setDropError(`${file.name} isn't a CSV file. Save it as .csv and try again.`);
              return;
            }
            // Show the dropped file in the picker too, as if it had been chosen.
            if (input.current) {
              const list = new DataTransfer();
              list.items.add(file);
              input.current.files = list.files;
            }
            choose(file);
          }}
        >
          <input
            key={key}
            ref={input}
            id={id}
            type="file"
            accept=".csv,text/csv"
            aria-describedby={[hintId, describedBy].filter(Boolean).join(" ")}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent-hover"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <p id={hintId} className="mt-2 text-xs text-muted">
            {over ? "Drop the file to use it." : "Or drag a CSV file here."}
          </p>
        </div>
        {name && (
          <button
            type="button"
            aria-label={`Remove ${name}`}
            className="btn-ghost btn-sm shrink-0"
            onClick={() => {
              choose(undefined);
              setKey((k) => k + 1);
              // The old input is gone, so put focus on the new one.
              requestAnimationFrame(() => document.getElementById(id)?.focus());
            }}
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Remove
          </button>
        )}
      </div>
      {dropError && (
        <p role="alert" className="text-sm text-not-ready">
          {dropError}
        </p>
      )}
    </div>
  );
}
