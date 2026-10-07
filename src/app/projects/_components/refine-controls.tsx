"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { quickUpdateStory } from "@/app/projects/actions";
import { emptyFormState } from "@/lib/form-state";
import { ESTIMATES } from "@/lib/stories/estimates";

/**
 * Records the size the team agreed on. The score on the page updates once it's
 * saved; the number keys 1, 2, 3, 5 and 8 press the matching button.
 */
export function EstimateButtons({ projectId, storyId, points }: { projectId: string; storyId: string; points: number | null }) {
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<number | null>(points);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // A saved change brings new points from the server; a new story also starts without "Saved".
  const [source, setSource] = useState({ storyId, points });
  if (source.storyId !== storyId || source.points !== points) {
    if (source.storyId !== storyId) setSaved(false);
    setSource({ storyId, points });
    setChosen(points);
  }

  const save = (value: number) => {
    setChosen(value);
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("field", "storyPoints");
      data.set("value", String(value));
      const result = await quickUpdateStory(projectId, storyId, emptyFormState, data);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <div role="group" aria-labelledby="estimate-label">
      <p id="estimate-label" className="text-sm font-medium">
        The team&apos;s estimate
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ESTIMATES.map((value) => (
          <button
            key={value}
            type="button"
            data-estimate={value}
            aria-pressed={chosen === value}
            disabled={pending}
            onClick={() => save(value)}
            className={`grid h-11 w-11 place-items-center rounded-lg border text-base font-semibold tabular-nums transition-colors ${
              chosen === value
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border-strong bg-surface hover:border-accent hover:text-accent"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <p role="status" className="mt-2 min-h-5 text-xs text-muted">
        {error ? (
          <span className="text-not-ready">{error}</span>
        ) : pending ? (
          "Saving…"
        ) : chosen === null ? (
          "Not estimated yet."
        ) : saved ? (
          `Saved: ${chosen} points.`
        ) : (
          `Current estimate: ${chosen} points.`
        )}
      </p>
    </div>
  );
}

/** Arrow keys move between stories; number keys record an estimate. Ignored while typing. */
export function RefineKeys({ prev, next }: { prev: string | null; next: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey || target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowRight" && next) router.push(next);
      else if (event.key === "ArrowLeft" && prev) router.push(prev);
      else if (/^[12358]$/.test(event.key)) document.querySelector<HTMLButtonElement>(`[data-estimate="${event.key}"]`)?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);
  return null;
}
