import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BandBadge } from "@/components/band-badge";
import { JiraInline, JiraText } from "@/components/jira-text";
import { Logo } from "@/components/logo";
import { ScoreRing } from "@/components/score-ring";
import { SecondLookList } from "@/components/second-look";
import { bandFor, scoreStory } from "@/lib/readiness/rules";
import { secondLook } from "@/lib/readiness/second-look";
import { db } from "@/lib/server/db";
import { settingsOf, toStory } from "@/lib/server/readiness";
import { doneStatusesOf } from "@/lib/server/sprint";
import { isDone } from "@/lib/sprint/metrics";
import { splitCriteria } from "@/lib/stories/types";

// Shared links stay out of search engines and never send the token on to other sites.
export const metadata: Metadata = { title: "Shared backlog", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * A backlog shared by its owner for refinement: unfinished stories in priority
 * order, each with its score and what to fix. Read-only, no account needed,
 * and gone once sharing is turned off.
 */
export default async function SharedBacklogPage({ params, searchParams }: PageProps<"/share/backlog/[token]">) {
  const { token } = await params;
  // Tokens are 43 base64url characters; anything else can't match, so skip the query.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const project = await db.project.findUnique({ where: { shareToken: token } });
  if (!project) notFound();
  const weakest = (await searchParams).sort === "weakest";

  const settings = settingsOf(project);
  const doneStatuses = doneStatusesOf(project);
  const rows = await db.story.findMany({ where: { projectId: project.id }, orderBy: [{ rank: "asc" }, { key: "asc" }] });
  const open = rows.filter((r) => !isDone(r.status, doneStatuses));
  const stories = open.map((row) => {
    const story = toStory(row);
    return { row, story, readiness: scoreStory(story, settings), looks: secondLook(story) };
  });
  if (weakest) stories.sort((a, b) => a.readiness.score - b.readiness.score || a.row.rank - b.row.rank);
  const ready = stories.filter((s) => s.readiness.band === "Ready").length;
  const finished = rows.length - open.length;
  const base = `/share/backlog/${token}`;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6">
      <header className="mx-auto mb-6 flex max-w-4xl items-center justify-between">
        <Logo />
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          What is Sprintwise?
        </Link>
      </header>
      <main id="main" className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="eyebrow">Shared backlog · read-only</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-2 text-muted">
            {ready} of {stories.length} {stories.length === 1 ? "story" : "stories"} ready for planning
            {finished > 0 && ` (${finished} finished not shown)`}. Open a story to see what to fix.
          </p>
        </div>

        <nav aria-label="Order" className="flex gap-2 text-sm">
          <Link href={base} aria-current={!weakest ? "page" : undefined} className={!weakest ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}>
            Priority order
          </Link>
          <Link
            href={`${base}?sort=weakest`}
            aria-current={weakest ? "page" : undefined}
            className={weakest ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}
          >
            Weakest first
          </Link>
        </nav>

        {stories.length === 0 ? (
          <p className="card p-6 text-center text-muted">No unfinished stories in this backlog.</p>
        ) : (
          <ul className="space-y-2">
            {stories.map(({ row, story, readiness, looks }) => {
              const criteria = splitCriteria(story.acceptanceCriteria);
              return (
                <li key={row.id}>
                  <details className="card group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-3 sm:p-4 [&::-webkit-details-marker]:hidden">
                      <ScoreRing score={readiness.score} band={readiness.band} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="font-mono text-xs text-subtle">{story.key}</span>{" "}
                        <span className="font-medium">{story.title}</span>
                        <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                          {story.issueType && story.issueType.toLowerCase() !== "story" && (
                            <span className="rounded bg-surface-2 px-1.5 font-medium text-foreground">{story.issueType}</span>
                          )}
                          {row.epic && <span>{row.epic}</span>}
                          {story.status && <span>{story.status}</span>}
                          <span>{story.storyPoints === null ? "Not estimated" : `${story.storyPoints} pts`}</span>
                        </span>
                      </span>
                      <span className="hidden sm:inline">
                        <BandBadge band={readiness.band} />
                      </span>
                    </summary>
                    <div className="space-y-4 border-t border-border p-4 text-sm">
                      {readiness.findings.length > 0 ? (
                        <div>
                          <h2 className="font-medium">What to fix</h2>
                          <ul className="mt-2 space-y-1.5">
                            {readiness.findings.map((f) => (
                              <li key={f.id} className="flex gap-2">
                                <span className="w-8 shrink-0 font-mono text-xs leading-5 text-not-ready">+{f.points}</span>
                                <span className="text-muted">
                                  <span className="font-medium text-foreground">{f.check}.</span> {f.reason}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-ready">Every check passed.</p>
                      )}
                      {readiness.bandCap && bandFor(readiness.score) !== readiness.band && (
                        <p className="rounded-lg bg-needs-work-bg px-3 py-2 text-needs-work">{readiness.bandCap}</p>
                      )}
                      {readiness.typeNote && <p className="text-muted">{readiness.typeNote}</p>}
                      <SecondLookList items={looks} compact id={`look-${row.id}`} />
                      <div>
                        <h2 className="eyebrow">Description</h2>
                        {story.description ? <JiraText text={story.description} className="mt-1" /> : <p className="mt-1 text-subtle">None</p>}
                      </div>
                      <div>
                        <h2 className="eyebrow">Acceptance criteria</h2>
                        {criteria.length === 0 ? (
                          <p className="mt-1 text-subtle">None</p>
                        ) : (
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {criteria.map((c, i) => (
                              <li key={i}>
                                <JiraInline text={c} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
