"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { requestSuggestion } from "@/app/projects/ai-actions";
import { BandBadge } from "@/components/band-badge";
import type { Suggestion } from "@/lib/ai/suggestion";
import type { Band } from "@/lib/readiness/rules";

type Score = { score: number; band: Band };

export function AiSuggestionPanel({
  projectId,
  storyId,
  eligible,
  original,
  suggestion,
  rewriteScore,
}: {
  projectId: string;
  storyId: string;
  /** Only stories that aren't Ready get suggestions (story R-4). */
  eligible: boolean;
  original: Score;
  suggestion: Suggestion | null;
  rewriteScore: Score | null;
}) {
  const [state, action, pending] = useActionState(requestSuggestion.bind(null, projectId, storyId), null);

  return (
    <section aria-labelledby="ai-heading" className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ai-heading" className="font-semibold">
          <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            AI suggestion
          </span>
          Rewrite and test scenarios
        </h2>
      </div>

      {!eligible && !suggestion ? (
        <p className="text-sm text-muted">This story is Ready, so it doesn&apos;t need a rewrite.</p>
      ) : (
        <form action={action} className="space-y-2">
          {/* F-5: the notice shows before the first AI call. */}
          <p className="text-sm text-muted">
            Sends this story&apos;s title, description and criteria to the Claude API by Anthropic. The score never uses
            AI, and your story is never changed. <Link href="/privacy" className="underline">Privacy</Link>
          </p>
          {eligible && (
            <button className="btn-primary" disabled={pending}>
              {pending ? "Asking Claude (up to 15 seconds)…" : suggestion ? "Suggest again" : "Suggest a rewrite"}
            </button>
          )}
          {state?.error && (
            <p role="alert" className="rounded-md bg-not-ready-bg px-3 py-2 text-sm text-not-ready">
              {state.error}
            </p>
          )}
        </form>
      )}

      {suggestion && rewriteScore && (
        <div aria-live="polite" className="space-y-5 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Rules score:</span>
            <span className="tabular-nums">{original.score}</span>
            <BandBadge band={original.band} />
            <span aria-hidden="true">→</span>
            <span className="sr-only">rewrite scores</span>
            <span className="font-semibold tabular-nums">{rewriteScore.score}</span>
            <BandBadge band={rewriteScore.band} />
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Suggested rewrite</h3>
              <CopyButton label="Copy rewrite" text={rewriteText(suggestion)} />
            </div>
            <p className="font-medium">{suggestion.rewrite.title}</p>
            <p className="text-muted">{suggestion.rewrite.description}</p>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {suggestion.rewrite.acceptance_criteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Test scenarios</h3>
              <CopyButton label="Copy scenarios" text={scenariosText(suggestion)} />
            </div>
            <ol className="space-y-3">
              {suggestion.scenarios.map((sc, i) => (
                <li key={i} className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted">{sc.criterion}</p>
                  <p className="mt-1">
                    <span className="font-semibold">Given</span> {sc.given}
                  </p>
                  <p>
                    <span className="font-semibold">When</span> {sc.when}
                  </p>
                  <p>
                    <span className="font-semibold">Then</span> {sc.then}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-muted">AI suggestion: check it before using it. Your original story is unchanged.</p>
        </div>
      )}
    </section>
  );
}

function rewriteText(s: Suggestion): string {
  return [s.rewrite.title, "", s.rewrite.description, "", "Acceptance criteria:", ...s.rewrite.acceptance_criteria.map((c) => `- ${c}`)].join("\n");
}

function scenariosText(s: Suggestion): string {
  return s.scenarios
    .map((sc) => `Scenario: ${sc.criterion}\n  Given ${sc.given}\n  When ${sc.when}\n  Then ${sc.then}`)
    .join("\n\n");
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary px-3 py-1 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
