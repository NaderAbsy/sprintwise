"use client";
import { useState } from "react";
import { BandBadge } from "@/components/band-badge";
import { ReadinessBreakdown } from "@/components/readiness-breakdown";
import type { Readiness } from "@/lib/readiness/rules";
import type { Story } from "@/lib/stories/types";

export function DemoBacklog({ scored }: { scored: { story: Story; readiness: Readiness }[] }) {
  const [openKey, setOpenKey] = useState<string | null>(scored[0]?.story.key ?? null);
  const open = scored.find((s) => s.story.key === openKey);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Sample stories sorted by readiness score, lowest first</caption>
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Score</th>
              <th scope="col" className="px-4 py-2 font-medium">Band</th>
              <th scope="col" className="px-4 py-2 font-medium">Story</th>
            </tr>
          </thead>
          <tbody>
            {scored.map(({ story, readiness }) => (
              <tr
                key={story.key}
                className={`border-b border-border last:border-0 ${story.key === openKey ? "bg-background" : ""}`}
              >
                <td className="px-4 py-2 font-semibold tabular-nums">{readiness.score}</td>
                <td className="px-4 py-2">
                  <BandBadge band={readiness.band} />
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    className="text-left hover:underline"
                    aria-pressed={story.key === openKey}
                    onClick={() => setOpenKey(story.key)}
                  >
                    <span className="mr-2 font-mono text-xs text-muted">{story.key}</span>{" "}
                    {story.title}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="space-y-3" aria-live="polite">
          <h2 className="font-semibold">
            <span className="mr-2 font-mono text-sm text-muted">{open.story.key}</span>{" "}
            {open.story.title}
          </h2>
          <ReadinessBreakdown readiness={open.readiness} />
        </div>
      )}
    </div>
  );
}
