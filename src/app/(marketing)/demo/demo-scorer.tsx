"use client";
import { useState } from "react";
import { ReadinessBreakdown } from "@/components/readiness-breakdown";
import { SecondLookList } from "@/components/second-look";
import { StoryFields } from "@/components/story-fields";
import { scoreStory, type Readiness } from "@/lib/readiness/rules";
import { secondLook, type SecondLook } from "@/lib/readiness/second-look";
import { parsePoints, STORY_TYPE_CHOICES, type Story } from "@/lib/stories/types";

/** The types the checker offers, the same as a project's editor. A Bug or Task is scored as in the app: the story-format checks count as passed. */
const TYPES: readonly string[] = STORY_TYPE_CHOICES;

/** Rules-only scoring in the browser: no AI call, no request, nothing saved. */
export function DemoScorer() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ readiness: Readiness; looks: SecondLook[] } | null>(null);
  // The same two things a story's own page shows: the score, and the signs of a draft nobody re-read.
  const check = (story: Story) => setResult({ readiness: scoreStory(story), looks: secondLook(story) });

  /** The form's story, and what's wrong with it before it can be scored. */
  function read(form: HTMLFormElement) {
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const points = parsePoints(text("storyPoints"));
    const problems: Record<string, string> = {};
    if (text("title") === "") problems.title = "Paste a story title to score.";
    if (!points.valid) problems.storyPoints = "Story points must be a number of 0 or more.";
    const story: Story = {
      key: "DEMO",
      title: text("title"),
      description: text("description"),
      acceptanceCriteria: text("acceptanceCriteria"),
      storyPoints: points.points,
      status: "",
      issueType: TYPES.includes(text("issueType")) ? text("issueType") : "Story",
    };
    return { story, problems };
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { story, problems } = read(event.currentTarget);
    setErrors(problems);
    if (Object.keys(problems).length > 0) setResult(null);
    else check(story);
  }

  // Like the home page, the score follows the typing once there's a title; the button also explains what's missing.
  function onInput(event: React.FormEvent<HTMLFormElement>) {
    const { story, problems } = read(event.currentTarget);
    if (Object.keys(problems).length === 0) {
      setErrors({});
      check(story);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <form onSubmit={onSubmit} onInput={onInput} className="card space-y-4 p-5" noValidate>
        <StoryFields errors={errors} />
        <div>
          <label htmlFor="issueType" className="label">
            Type
          </label>
          <select id="issueType" name="issueType" defaultValue="Story" className="field mt-1 w-36" aria-describedby="issueType-hint">
            {TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <p id="issueType-hint" className="mt-1 text-xs text-muted">
            Bugs and tasks skip the &ldquo;As a &hellip; I want &hellip; so that &hellip;&rdquo; checks, as they do in a project.
          </p>
        </div>
        <button className="btn-primary">Score this story</button>
      </form>
      <div aria-live="polite">
        {result ? (
          <div className="space-y-4">
            <ReadinessBreakdown readiness={result.readiness} />
            <SecondLookList items={result.looks} id="demo-second-look" />
          </div>
        ) : (
          <div className="card grid min-h-48 place-items-center p-6 text-center text-sm text-subtle">
            The score and every reason appear here.
          </div>
        )}
      </div>
    </div>
  );
}
