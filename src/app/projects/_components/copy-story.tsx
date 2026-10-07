"use client";
import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";

/** Copies some text and says so for two seconds. */
export function CopyButton({ text, label, className = "btn-secondary" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <ClipboardCopy aria-hidden="true" className="h-4 w-4" />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

/** Copies the story as plain text, ready to paste into Jira, Slack or a doc. */
export function CopyStoryButton({ text }: { text: string }) {
  return <CopyButton text={text} label="Copy as text" />;
}
