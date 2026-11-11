"use client";
import { Check, Minus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BandBadge } from "@/components/band-badge";
import { ScoreRing } from "@/components/score-ring";
import { SecondLookList } from "@/components/second-look";
import { FULL_SCORE_NOTE, scoreStory } from "@/lib/readiness/rules";
import { secondLook } from "@/lib/readiness/second-look";
import { STORY_TYPE_CHOICES } from "@/lib/stories/types";

const EXAMPLES = [
  {
    label: "A vague one",
    title: "Make checkout fast and easy",
    description: "",
    criteria: "",
  },
  {
    label: "Getting there",
    title: "Refund a payment",
    description: "As a support agent I want to refund a payment so that the customer gets their money back",
    criteria: "",
  },
  {
    label: "Ready",
    title: "Refund a payment",
    description: "As a support agent I want to refund a payment so that the customer gets their money back",
    criteria: "- Full and partial refunds are supported\n- The customer gets an email within 1 minute",
  },
];

/**
 * The hero's live demo: type a story and the same rules the app uses score it on every keystroke.
 * Runs entirely in the browser; nothing is sent.
 */
export function HeroScorer() {
  const [title, setTitle] = useState(EXAMPLES[0].title);
  const [description, setDescription] = useState(EXAMPLES[0].description);
  const [criteria, setCriteria] = useState(EXAMPLES[0].criteria);
  // Story unless the visitor says otherwise: a Bug or Task is scored as in a project, without the story-format checks.
  const [type, setType] = useState<string>(STORY_TYPE_CHOICES[0]);
  const [example, setExample] = useState<number | null>(0);

  const { readiness, looks } = useMemo(() => {
    const story = { key: "LIVE", title: title.trim() || " ", description, acceptanceCriteria: criteria, storyPoints: 3, status: "", issueType: type };
    return { readiness: scoreStory(story), looks: secondLook(story) };
  }, [title, description, criteria, type]);
  const failed = readiness.findings;

  return (
    <div className="card relative overflow-hidden p-0 shadow-2xl shadow-accent/10">
      <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium text-muted">
          <span aria-hidden="true" className="animate-pulse-dot h-2 w-2 rounded-full bg-ready-dot" />
          Live readiness check
        </span>
        <span className="text-xs text-subtle">Runs in your browser</span>
      </div>

      <div className="grid gap-0 sm:grid-cols-[1fr_15rem]">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Example stories">
            {EXAMPLES.map((ex, i) => (
              <button
                key={ex.label}
                type="button"
                aria-pressed={example === i}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-foreground aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-soft-foreground"
                onClick={() => {
                  setExample(i);
                  setTitle(ex.title);
                  setDescription(ex.description);
                  setCriteria(ex.criteria);
                  setType(STORY_TYPE_CHOICES[0]);
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <div>
              <label htmlFor="hero-title" className="text-xs font-medium text-muted">
                Story title
              </label>
              <input id="hero-title" value={title} onChange={(e) => {
                  setExample(null);
                  setTitle(e.target.value);
                }} className="field mt-1" />
            </div>
            <div>
              <label htmlFor="hero-type" className="text-xs font-medium text-muted">
                Type
              </label>
              <select
                id="hero-type"
                value={type}
                onChange={(e) => {
                  setExample(null);
                  setType(e.target.value);
                }}
                className="field mt-1 w-24"
              >
                {STORY_TYPE_CHOICES.map((choice) => (
                  <option key={choice}>{choice}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="hero-description" className="text-xs font-medium text-muted">
              Description
            </label>
            <textarea
              id="hero-description"
              rows={2}
              value={description}
              onChange={(e) => {
                setExample(null);
                setDescription(e.target.value);
              }}
              placeholder="As a … I want … so that …"
              className="field mt-1 resize-none"
            />
          </div>
          <div>
            <label htmlFor="hero-criteria" className="text-xs font-medium text-muted">
              Acceptance criteria <span className="text-subtle">(one per line)</span>
            </label>
            <textarea
              id="hero-criteria"
              rows={2}
              value={criteria}
              onChange={(e) => {
                setExample(null);
                setCriteria(e.target.value);
              }}
              className="field mt-1 resize-none font-mono text-xs"
            />
          </div>
        </div>

        <div aria-live="polite" className="flex flex-col border-t border-border bg-surface-2/30 p-4 sm:border-t-0 sm:border-l">
          <div className="flex items-center gap-3">
            <span className="ring-animate">
              <ScoreRing score={readiness.score} band={readiness.band} size="md" />
            </span>
            <div className="space-y-1">
              <BandBadge band={readiness.band} />
              <p className="text-xs text-muted">
                {failed.length === 0 ? "Every check passed" : `${failed.length} ${failed.length === 1 ? "thing" : "things"} to fix`}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5 text-xs">
            {readiness.rules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-2">
                {rule.passed ? (
                  <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ready-dot" />
                ) : rule.coveredBy ? (
                  // Fails only because another rule did; counted in that rule's reason.
                  <Minus aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
                ) : (
                  <X aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-not-ready-dot" />
                )}
                <span className={rule.passed || rule.coveredBy ? "text-subtle" : "text-foreground"}>
                  {rule.check}
                  <span className="sr-only">
                    {rule.passed ? ": passed" : rule.coveredBy ? ": follows from an earlier check" : ": failed"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {readiness.typeNote && <p className="mt-3 text-xs text-muted">{readiness.typeNote}</p>}
          {readiness.bandCap && <p className="mt-3 text-xs text-needs-work">{readiness.bandCap}</p>}
          {failed.length === 0 && <p className="mt-3 text-xs text-muted">{FULL_SCORE_NOTE}</p>}
          <Link href="/demo#try-it" className="mt-auto inline-flex items-center gap-1.5 pt-4 text-xs font-medium text-accent hover:underline">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            See every reason in the demo
          </Link>
        </div>
      </div>
      {/* Only for a pasted draft: the notes a held-back story's card points to, as on the demo page. */}
      <div aria-live="polite">
        {looks.length > 0 && (
          <div className="border-t border-border p-4">
            <SecondLookList items={looks} compact id="hero-second-look" />
          </div>
        )}
      </div>
    </div>
  );
}
