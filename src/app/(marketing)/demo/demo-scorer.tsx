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

  /** The form's story, and what's wrong with it before it can be scored. */
  function read(form: HTMLFormElement) {
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const points = parsePoints(text("storyPoints"));
    const problems: Record<string, string> = {};
    if (text("title") === "") problems.title = "Paste a story title to score.";
    if (!points.valid) problems.storyPoints = "Story points must be a number of 0 or more.";
    const story = {
      key: "DEMO",
      title: text("title"),
      description: text("description"),
      acceptanceCriteria: text("acceptanceCriteria"),
      storyPoints: points.points,
      status: "",
    };
    return { story, problems };
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { story, problems } = read(event.currentTarget);
    setErrors(problems);
    setReadiness(Object.keys(problems).length > 0 ? null : scoreStory(story));
  }

  // Like the home page, the score follows the typing once there's a title; the button also explains what's missing.
  function onInput(event: React.FormEvent<HTMLFormElement>) {
    const { story, problems } = read(event.currentTarget);
    if (Object.keys(problems).length === 0) {
      setErrors({});
      setReadiness(scoreStory(story));
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <form onSubmit={onSubmit} onInput={onInput} className="card space-y-4 p-5" noValidate>
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
