import type { Metadata } from "next";
import { ArrowRight, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiSuggestionPanel } from "@/app/projects/_components/ai-suggestion-panel";
import { CopyButton, CopyStoryButton } from "@/app/projects/_components/copy-story";
import { storyAsText } from "@/lib/csv/export";
import { deleteStory, markCopiedToJira } from "@/app/projects/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { JiraInline, JiraText } from "@/components/jira-text";
import { ReadinessBreakdown } from "@/components/readiness-breakdown";
import { RemoveSection } from "@/components/remove-section";
import { SecondLookList } from "@/components/second-look";
import { secondLook } from "@/lib/readiness/second-look";
import { SectionHeader } from "@/components/section-header";
import { rewriteAsStory, SuggestionSchema } from "@/lib/ai/suggestion";
import { scoreStory } from "@/lib/readiness/rules";
import { aiConfigured } from "@/lib/server/ai";
import { db } from "@/lib/server/db";
import { requireProject, requireUser } from "@/lib/server/dal";
import { jiraAccount, jiraConfigured } from "@/lib/server/jira";
import { SendToJiraButton } from "@/app/projects/_components/jira-buttons";
import { settingsOf, toStory } from "@/lib/server/readiness";
import { criteriaOf } from "@/lib/stories/types";
import { doneStatusesOf } from "@/lib/server/sprint";
import { isDone } from "@/lib/sprint/metrics";

export const metadata: Metadata = { title: "Story" };

export default async function StoryPage({ params, searchParams }: PageProps<"/projects/[projectId]/stories/[storyId]">) {
  const { projectId, storyId } = await params;
  const saved = (await searchParams).saved === "1";
  const project = await requireProject(projectId);
  const row = await db.story.findFirst({ where: { id: storyId, projectId: project.id }, include: { readiness: true } });
  if (!row) notFound();

  const story = toStory(row);
  const settings = settingsOf(project);
  const readiness = scoreStory(story, settings);
  const { lines: criteria, fromDescription } = criteriaOf(story);
  // Stored suggestions are re-checked against the schema before they're shown.
  const stored = SuggestionSchema.safeParse(row.readiness?.aiSuggestion);
  const suggestion = stored.success ? stored.data : null;
  const rewrite = suggestion ? scoreStory(rewriteAsStory(story, suggestion), settings) : null;

  const base = `/projects/${project.id}`;
  const finishedStory = isDone(story.status, doneStatusesOf(project));
  const jiraLinked = Boolean(row.editedAt) && jiraConfigured && Boolean(project.jiraCloudId) && Boolean(await jiraAccount((await requireUser()).id));

  // "Next to fix": the next weakest story that isn't Ready, in the same order as the backlog's "weakest first".
  // Finished stories need no fixing, so they're skipped.
  const doneStatuses = doneStatusesOf(project);
  const unready = (
    await db.story.findMany({
      where: { projectId: project.id, readiness: { is: { band: { not: "Ready" } } } },
      select: { id: true, key: true, title: true, rank: true, status: true, readiness: { select: { score: true } } },
    })
  ).filter((s) => s.id === row.id || !isDone(s.status, doneStatuses));
  unready.sort((a, b) => (a.readiness?.score ?? 0) - (b.readiness?.score ?? 0) || a.rank - b.rank);
  const here = unready.findIndex((s) => s.id === row.id);
  const next = [...unready.slice(here + 1), ...unready.slice(0, Math.max(here, 0))].find((s) => s.id !== row.id);

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
          <>
            {next && (
              <Link
                href={`${base}/stories/${next.id}`}
                className="btn-ghost"
                title={`${next.key} ${next.title}`}
                aria-label={`Next to fix: ${next.key}`}
              >
                Next to fix
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            )}
            <CopyStoryButton text={storyAsText(story)} />
            <Link href={`${base}/stories/${row.id}/edit`} className="btn-primary">
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Edit story
            </Link>
          </>
        }
      />

      {saved && (
        <p role="status" className="mb-6 rounded-lg bg-ready-bg px-4 py-3 text-sm text-ready">
          Changes saved and the story re-scored.
        </p>
      )}
      {row.editedAt && (
        <section
          aria-labelledby="jira-copy"
          className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-soft-foreground"
        >
          <h2 id="jira-copy" className="mr-auto font-medium">
            {jiraLinked
              ? "Edited here, not yet in Jira."
              : "Edited here, not yet in Jira. Copy each field into the Jira issue, then mark it copied."}
          </h2>
          {jiraLinked && <SendToJiraButton projectId={project.id} storyIds={[row.id]} label="Send to Jira" />}
          <CopyButton text={story.description} label="Copy description" className="btn-secondary btn-sm" />
          <CopyButton text={story.acceptanceCriteria} label="Copy acceptance criteria" className="btn-secondary btn-sm" />
          <form action={markCopiedToJira.bind(null, project.id, row.id)}>
            <button className="btn-primary btn-sm">Mark as copied to Jira</button>
          </form>
        </section>
      )}
      {finishedStory && (
        <p className="mb-6 rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
          This story is {story.status}, so it&apos;s finished: it isn&apos;t counted in the backlog&apos;s readiness, and
          Next to fix skips it.
        </p>
      )}
      {!saved && !finishedStory && readiness.band !== "Ready" && (
        <p className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-soft-foreground">
          Each reason below says what to fix. Edit the story and the score updates as you type.
          <Link href={`${base}/stories/${row.id}/edit`} className="font-medium underline underline-offset-2">
            Improve this story
          </Link>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <ReadinessBreakdown readiness={readiness} />
          <SecondLookList items={secondLook(story)} />
        </div>

        <section aria-label="The story" className="card divide-y divide-border text-sm">
          <div className="p-5">
            <h2 className="eyebrow">Description</h2>
            {story.description ? <JiraText text={story.description} className="mt-2" /> : <p className="mt-2 text-subtle">None</p>}
          </div>
          <div className="p-5">
            <h2 className="eyebrow">Acceptance criteria</h2>
            {fromDescription && <p className="mt-1 text-xs text-muted">From the description&apos;s Acceptance criteria section.</p>}
            {criteria.length === 0 ? (
              <p className="mt-2 text-subtle">None</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {criteria.map((c, i) => (
                  <li key={i}>
                    <JiraInline text={c} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <dl className="grid grid-cols-3 p-5">
            <div>
              <dt className="eyebrow">Type</dt>
              <dd className="mt-1">{story.issueType || "Story"}</dd>
            </div>
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

      <RemoveSection
        title="Delete this story"
        action={
          <ConfirmButton
            label="Delete story"
            title={`Delete ${story.key}?`}
            body="This removes the story and its score from the project."
            confirmLabel="Delete story"
            action={deleteStory.bind(null, project.id, row.id)}
          />
        }
      >
        Removes it from the backlog. Sprints that already include it keep their own copy.
      </RemoveSection>
    </>
  );
}
