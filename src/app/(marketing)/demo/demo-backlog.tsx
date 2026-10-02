"use client";
import { useState } from "react";
import { BandBadge } from "@/components/band-badge";
import { ReadinessBreakdown } from "@/components/readiness-breakdown";
import { ScoreRing } from "@/components/score-ring";
import type { Readiness } from "@/lib/readiness/rules";
import type { Story } from "@/lib/stories/types";

export function DemoBacklog({ scored }: { scored: { story: Story; readiness: Readiness }[] }) {
  const [openKey, setOpenKey] = useState<string | null>(scored[0]?.story.key ?? null);
  const open = scored.find((s) => s.story.key === openKey);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="card overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">Sample stories sorted by readiness score, lowest first</caption>
          <thead>
            <tr>
              <th scope="col" className="w-16">Score</th>
              <th scope="col">Story</th>
              <th scope="col" className="w-32">Band</th>
            </tr>
          </thead>
          <tbody>
            {scored.map(({ story, readiness }) => {
              const selected = story.key === openKey;
              return (
                <tr key={story.key} className={selected ? "bg-accent-soft/60 hover:bg-accent-soft/60" : ""}>
                  <td>
                    <ScoreRing score={readiness.score} band={readiness.band} size="sm" />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-left"
                      aria-pressed={selected}
                      onClick={() => setOpenKey(story.key)}
                    >
                      <span className="font-mono text-xs text-subtle">{story.key}</span>{" "}
                      <span className={`font-medium hover:underline ${selected ? "text-accent" : ""}`}>{story.title}</span>
                    </button>
                  </td>
                  <td>
                    <BandBadge band={readiness.band} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="space-y-3 lg:sticky lg:top-32 lg:self-start" aria-live="polite">
          <h2 className="font-semibold">
            <span className="mr-2 font-mono text-sm font-normal text-subtle">{open.story.key}</span>{" "}
            {open.story.title}
          </h2>
          <ReadinessBreakdown readiness={open.readiness} />
        </div>
      )}
    </div>
  );
}
