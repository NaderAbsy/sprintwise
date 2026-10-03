"use client";
import { Check } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { addStory, updateStory } from "@/app/projects/actions";
import { BandBadge } from "@/components/band-badge";
import { FormAlert } from "@/components/form-feedback";
import { ScoreRing } from "@/components/score-ring";
import { StoryFields, type StoryDefaults } from "@/components/story-fields";
import { emptyFormState } from "@/lib/form-state";
import { scoreStory, type Readiness, type RuleSettings } from "@/lib/readiness/rules";
import { readStoryForm } from "@/lib/stories/form";

type EditedStory = { id: string; key: string } & StoryDefaults;

function preview(data: FormData, settings: RuleSettings): Readiness {
  const { story } = readStoryForm(data);
  return scoreStory({ key: "PREVIEW", ...story, title: story.title || " " }, settings);
}

/**
 * Score a new story or edit a saved one. The score updates as you type, with
 * the project's own rule settings, so you can fix a story before saving it.
 */
export function StoryEditor({ projectId, settings, story }: { projectId: string; settings: RuleSettings; story?: EditedStory }) {
  const serverAction = story ? updateStory.bind(null, projectId, story.id) : addStory.bind(null, projectId);
  const [state, action, pending] = useActionState(serverAction, emptyFormState);
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

  return (
    <form
      action={action}
      onInput={(event) => setReadiness(preview(new FormData(event.currentTarget), settings))}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      noValidate
    >
      <div className="card space-y-4 p-5">
        <StoryFields errors={state.fieldErrors} showKey={!story} showStatus defaults={story} />
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
        {failed.length === 0 ? (
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
            </ul>
          </div>
        )}
      </aside>
    </form>
  );
}
