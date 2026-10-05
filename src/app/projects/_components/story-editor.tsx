"use client";
import { Check, ListPlus, Wand2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { addStory, updateStory } from "@/app/projects/actions";
import { BandBadge } from "@/components/band-badge";
import { FormAlert } from "@/components/form-feedback";
import { ScoreRing } from "@/components/score-ring";
import { StoryFields, type StoryDefaults } from "@/components/story-fields";
import { useLeaveWarning } from "@/components/use-leave-warning";
import { emptyFormState } from "@/lib/form-state";
import { findVagueWords, scoreStory, type Readiness, type RuleSettings } from "@/lib/readiness/rules";
import { hasPlaceholders, SCENARIO_TEMPLATE, SPLIT_PATTERNS, STORY_TEMPLATE, vagueWordTips } from "@/lib/stories/helpers";
import { readStoryForm } from "@/lib/stories/form";

type EditedStory = { id: string; key: string } & StoryDefaults;

function preview(data: FormData, settings: RuleSettings): { readiness: Readiness; vague: string[]; placeholders: boolean } {
  const { story } = readStoryForm(data);
  return {
    placeholders: hasPlaceholders(`${story.description}\n${story.acceptanceCriteria}`),
    readiness: scoreStory({ key: "PREVIEW", ...story, title: story.title || " " }, settings),
    vague: findVagueWords(`${story.title}\n${story.description}\n${story.acceptanceCriteria}`, settings.vagueWords),
  };
}

/** Sets a field's value as if the user typed it, so the live score updates too. */
function insert(form: HTMLFormElement | null, name: string, text: string, mode: "replace-if-empty" | "append") {
  const field = form?.elements.namedItem(name);
  if (!(field instanceof HTMLTextAreaElement)) return;
  const current = field.value.trim();
  if (mode === "replace-if-empty" && current !== "") return field.focus();
  field.value = current === "" ? text : `${current}\n${text}`;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.focus();
  // Select the first [placeholder] so the user can type straight over it.
  const start = field.value.indexOf("[", field.value.length - text.length);
  const end = field.value.indexOf("]", start) + 1;
  if (start >= 0 && end > start) field.setSelectionRange(start, end);
}

/**
 * Score a new story or edit a saved one. The score updates as you type, with
 * the project's own rule settings, so you can fix a story before saving it.
 */
export function StoryEditor({ projectId, settings, story }: { projectId: string; settings: RuleSettings; story?: EditedStory }) {
  const serverAction = story ? updateStory.bind(null, projectId, story.id) : addStory.bind(null, projectId);
  const [state, action, pending] = useActionState(serverAction, emptyFormState);
  const form = useRef<HTMLFormElement>(null);
  const [placeholders, setPlaceholders] = useState(false);
  const [dirty, setDirty] = useState(false);
  useLeaveWarning(dirty);
  const [vague, setVague] = useState<string[]>(() =>
    findVagueWords(`${story?.title ?? ""}\n${story?.description ?? ""}\n${story?.acceptanceCriteria ?? ""}`, settings.vagueWords),
  );
  const [readiness, setReadiness] = useState<Readiness>(() =>
    scoreStory(
      {
        key: "PREVIEW",
        title: story?.title || " ",
        description: story?.description ?? "",
        acceptanceCriteria: story?.acceptanceCriteria ?? "",
        storyPoints: story?.storyPoints ?? null,
        status: story?.status ?? "",
      },
      settings,
    ),
  );
  const failed = readiness.rules.filter((r) => !r.passed);
  const failedCustom = readiness.custom.filter((c) => !c.passed);

  return (
    <form
      action={action}
      ref={form}
      onInput={(event) => {
        setDirty(true);
        const next = preview(new FormData(event.currentTarget), settings);
        setReadiness(next.readiness);
        setVague(next.vague);
        setPlaceholders(next.placeholders);
      }}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      noValidate
    >
      <div className="card space-y-4 p-5">
        <StoryFields errors={state.fieldErrors} showKey={!story} showStatus defaults={story} />
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <span className="self-center text-xs text-muted">Writing help:</span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => insert(form.current, "description", STORY_TEMPLATE, "replace-if-empty")}>
            <Wand2 aria-hidden="true" className="h-3.5 w-3.5" />
            Story template
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => insert(form.current, "acceptanceCriteria", SCENARIO_TEMPLATE, "append")}>
            <ListPlus aria-hidden="true" className="h-3.5 w-3.5" />
            Add a Given / When / Then
          </button>
        </div>
        <FormAlert state={state} />
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : story ? "Save changes" : "Score and save"}
          </button>
          <Link href={story ? `/projects/${projectId}/stories/${story.id}` : `/projects/${projectId}`} className="btn-ghost">
            Cancel
          </Link>
        </div>
      </div>

      <aside aria-label="Live score" className="card space-y-4 p-5 lg:sticky lg:top-20">
        <div aria-live="polite" className="flex items-center gap-3">
          <span className="ring-animate">
            <ScoreRing score={readiness.score} band={readiness.band} size="md" />
          </span>
          <div className="space-y-1">
            <BandBadge band={readiness.band} />
            <p className="text-xs text-muted">Updates as you type</p>
          </div>
        </div>
        {readiness.bandCap && <p className="text-sm text-needs-work">{readiness.bandCap}</p>}
        {placeholders && (
          <p role="status" className="rounded-lg bg-needs-work-bg px-3 py-2 text-sm text-needs-work">
            Replace the [placeholders] from the template with your own words before saving.
          </p>
        )}
        {failed.length === 0 && failedCustom.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-ready">
            <Check aria-hidden="true" className="h-4 w-4" />
            Every check passed.
          </p>
        ) : (
          <div>
            <p className="text-sm font-medium">To raise the score</p>
            <ul className="mt-2 space-y-2 text-sm">
              {failed.map((rule) => (
                <li key={rule.id} className="flex gap-2">
                  <span className="w-8 shrink-0 font-mono text-xs leading-5 text-not-ready">+{rule.points}</span>
                  <span className="text-muted">{rule.reason}</span>
                </li>
              ))}
              {failedCustom.map((check) => (
                <li key={check.name} className="flex gap-2">
                  <span className="w-8 shrink-0 font-mono text-xs leading-5 text-needs-work">team</span>
                  <span className="text-muted">
                    {check.name}: {check.reason}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {vague.length > 0 && (
          <details className="rounded-lg bg-surface-2 p-3 text-sm" open>
            <summary className="cursor-pointer font-medium">Instead of vague words</summary>
            <ul className="mt-2 space-y-1.5">
              {vagueWordTips(vague).map((t) => (
                <li key={t.words.join()}>
                  <span className="font-medium">{t.words.map((w) => `“${w}”`).join(", ")}:</span>{" "}
                  <span className="text-muted">{t.tip}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {readiness.rules.some((r) => r.id === "C7" && !r.passed && readiness.rules.find((x) => x.id === "C6")?.passed) && (
          <details className="rounded-lg bg-surface-2 p-3 text-sm" open>
            <summary className="cursor-pointer font-medium">Ways to split a big story</summary>
            <ul className="mt-2 space-y-1.5">
              {SPLIT_PATTERNS.map((p) => (
                <li key={p.name}>
                  <span className="font-medium">{p.name}:</span> <span className="text-muted">{p.example}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </aside>
    </form>
  );
}
