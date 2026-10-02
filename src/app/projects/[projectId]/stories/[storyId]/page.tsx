import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiSuggestionPanel } from "@/app/projects/_components/ai-suggestion-panel";
import { deleteStory } from "@/app/projects/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { ReadinessBreakdown } from "@/components/readiness-breakdown";
import { SectionHeader } from "@/components/section-header";
import { rewriteAsStory, SuggestionSchema } from "@/lib/ai/suggestion";
import { scoreStory } from "@/lib/readiness/rules";
import { aiConfigured } from "@/lib/server/ai";
import { db } from "@/lib/server/db";
import { requireProject } from "@/lib/server/dal";
import { settingsOf, toStory } from "@/lib/server/readiness";
import { splitCriteria } from "@/lib/stories/types";

export const metadata: Metadata = { title: "Story" };

export default async function StoryPage({ params }: PageProps<"/projects/[projectId]/stories/[storyId]">) {
  const { projectId, storyId } = await params;
  const project = await requireProject(projectId);
  const row = await db.story.findFirst({ where: { id: storyId, projectId: project.id }, include: { readiness: true } });
  if (!row) notFound();

  const story = toStory(row);
  const settings = settingsOf(project);
  const readiness = scoreStory(story, settings);
  const criteria = splitCriteria(story.acceptanceCriteria);
  // Stored suggestions are re-checked against the schema before they're shown.
  const stored = SuggestionSchema.safeParse(row.readiness?.aiSuggestion);
  const suggestion = stored.success ? stored.data : null;
  const rewrite = suggestion ? scoreStory(rewriteAsStory(story, suggestion), settings) : null;

  const base = `/projects/${project.id}`;

  return (
    <>
      <SectionHeader
        back={{ href: base, label: "Backlog" }}
        title={
          <>
            <span className="mr-2 font-mono text-base font-normal text-subtle">{story.key}</span> {story.title}
          </>
        }
        actions={
          <ConfirmButton
            label="Delete story"
            title={`Delete ${story.key}?`}
            body="This removes the story and its score from the project."
            confirmLabel="Delete story"
            action={deleteStory.bind(null, project.id, row.id)}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ReadinessBreakdown readiness={readiness} />

        <section aria-label="The story" className="card divide-y divide-border text-sm">
          <div className="p-5">
            <h2 className="eyebrow">Description</h2>
            <p className="mt-2 whitespace-pre-wrap">{story.description || <span className="text-subtle">None</span>}</p>
          </div>
          <div className="p-5">
            <h2 className="eyebrow">Acceptance criteria</h2>
            {criteria.length === 0 ? (
              <p className="mt-2 text-subtle">None</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </div>
          <dl className="grid grid-cols-2 p-5">
            <div>
              <dt className="eyebrow">Points</dt>
              <dd className="mt-1">{story.storyPoints ?? <span className="text-subtle">Not estimated</span>}</dd>
            </div>
            <div>
              <dt className="eyebrow">Status</dt>
              <dd className="mt-1">{story.status || <span className="text-subtle">—</span>}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* AI is off unless ANTHROPIC_API_KEY is set; then the panel isn't shown at all (DECISIONS.md, 2026-10-02). */}
      {aiConfigured && (
        <div className="mt-6">
          <AiSuggestionPanel
            projectId={project.id}
            storyId={row.id}
            eligible={readiness.band !== "Ready"}
            original={{ score: readiness.score, band: readiness.band }}
            suggestion={suggestion}
            rewriteScore={rewrite && { score: rewrite.score, band: rewrite.band }}
          />
        </div>
      )}
    </>
  );
}
