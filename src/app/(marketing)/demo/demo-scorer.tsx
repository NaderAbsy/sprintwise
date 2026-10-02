"use client";
import { useState } from "react";
import { ReadinessBreakdown } from "@/components/readiness-breakdown";
import { StoryFields } from "@/components/story-fields";
import { scoreStory, type Readiness } from "@/lib/readiness/rules";
import { parsePoints } from "@/lib/stories/types";

/** Rules-only scoring in the browser: no AI call, no request, nothing saved. */
export function DemoScorer() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const points = parsePoints(text("storyPoints"));
    const next: Record<string, string> = {};
    if (text("title") === "") next.title = "Paste a story title to score.";
    if (!points.valid) next.storyPoints = "Story points must be a number of 0 or more.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setReadiness(null);
      return;
    }
    setReadiness(
      scoreStory({
        key: "DEMO",
        title: text("title"),
        description: text("description"),
        acceptanceCriteria: text("acceptanceCriteria"),
        storyPoints: points.points,
        status: "",
      }),
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="card space-y-4 p-5" noValidate>
        <StoryFields errors={errors} />
        <button className="btn-primary">Score this story</button>
      </form>
      <div aria-live="polite">
        {readiness ? (
          <ReadinessBreakdown readiness={readiness} />
        ) : (
          <div className="card grid min-h-48 place-items-center p-6 text-center text-sm text-subtle">
            The score and every reason appear here.
          </div>
        )}
      </div>
    </div>
  );
}
