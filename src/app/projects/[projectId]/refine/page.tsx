import { ArrowLeft, ArrowRight, Pencil, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EstimateButtons, RefineKeys } from "@/app/projects/_components/refine-controls";
import { BandBadge } from "@/components/band-badge";
import { EmptyState } from "@/components/empty-state";
import { JiraInline, JiraText } from "@/components/jira-text";
import { ScoreRing } from "@/components/score-ring";
import { SecondLookList } from "@/components/second-look";
import { scoreStory } from "@/lib/readiness/rules";
import { secondLook } from "@/lib/readiness/second-look";
import { db } from "@/lib/server/db";
import { requireProject } from "@/lib/server/dal";
import { refreshStaleScores, settingsOf, toStory } from "@/lib/server/readiness";
import { doneStatusesOf } from "@/lib/server/sprint";
import { isDone } from "@/lib/sprint/metrics";
import { criteriaOf } from "@/lib/stories/types";

export const metadata: Metadata = { title: "Refinement" };

/**
 * Refinement mode: the team's meeting screen. One story at a time, in priority
 * order: what it says, what's missing, and a row of sizes to record the
 * estimate the team agrees on.
 */
export default async function RefinePage({ params, searchParams }: PageProps<"/projects/[projectId]/refine">) {
  const { projectId } = await params;
  const { story: storyParam, scope: scopeParam, done: doneParam } = await searchParams;
  const project = await requireProject(projectId);
  const all = scopeParam === "all";
  const base = `/projects/${project.id}`;
  await refreshStaleScores([project.id]);

  const doneStatuses = doneStatusesOf(project);
  const rows = await db.story.findMany({
    where: { projectId: project.id },
    include: { readiness: true },
    orderBy: [{ rank: "asc" }, { key: "asc" }],
  });
  const open = rows.filter((r) => !isDone(r.status, doneStatuses));
  // "Not ready yet" is decided by the stored band, but the story on screen stays in the list after it becomes Ready.
  const list = all ? open : open.filter((r) => r.readiness?.band !== "Ready" || r.id === storyParam);
  const href = (id: string) => `${base}/refine?story=${id}${all ? "&scope=all" : ""}`;
  const scopeHref = (scope: "all" | "unready") => `${base}/refine${scope === "all" ? "?scope=all" : ""}`;

  const scopeNav = (
    <nav aria-label="Which stories" className="flex flex-wrap gap-2 text-sm">
      <Link href={scopeHref("unready")} aria-current={!all ? "page" : undefined} className={!all ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}>
        Not ready yet
      </Link>
      <Link href={scopeHref("all")} aria-current={all ? "page" : undefined} className={all ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}>
        All unfinished
      </Link>
    </nav>
  );

  // The end: a short summary of where the backlog stands now.
  if (doneParam === "1" || list.length === 0) {
    const ready = open.filter((r) => r.readiness?.band === "Ready").length;
    const unestimated = open.filter((r) => r.storyPoints === null).length;
    return (
      <div className="space-y-6">
        <RefineHeader base={base} />
        {scopeNav}
        <EmptyState icon={Users} title={list.length === 0 ? "Nothing left to refine here." : "That's the lot."}>
          {ready} of {open.length} unfinished {open.length === 1 ? "story is" : "stories are"} Ready
          {unestimated > 0 ? `, and ${unestimated} still ${unestimated === 1 ? "has" : "have"} no estimate` : ", and every one is estimated"}.{" "}
          <Link href={base} className="text-accent underline underline-offset-2">
            Back to the backlog
          </Link>
        </EmptyState>
      </div>
    );
  }

  const index = Math.max(0, list.findIndex((r) => r.id === storyParam));
  const row = list[index];
  const story = toStory(row);
  const readiness = scoreStory(story, settingsOf(project));
  const looks = secondLook(story);
  const { lines: criteria, fromDescription } = criteriaOf(story);
  const prev = index > 0 ? href(list[index - 1].id) : null;
  const next = index < list.length - 1 ? href(list[index + 1].id) : `${base}/refine?done=1${all ? "&scope=all" : ""}`;

  return (
    <div className="space-y-6">
      <RefineHeader base={base} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {scopeNav}
        <p className="text-sm text-muted" aria-live="polite">
          Story {index + 1} of {list.length}
        </p>
      </div>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((index + 1) / list.length) * 100}%` }} />
      </div>

      <article aria-labelledby="refine-title" className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="card space-y-5 p-5 text-sm">
          <div>
            <p className="font-mono text-xs text-subtle">
              {story.key}
              {story.issueType && story.issueType.toLowerCase() !== "story" && ` · ${story.issueType}`}
              {row.epic && ` · ${row.epic}`}
              {story.status && ` · ${story.status}`}
            </p>
            <h2 id="refine-title" className="mt-1 text-xl font-semibold tracking-tight">
              {story.title}
            </h2>
          </div>
          <div>
            <h3 className="eyebrow">Description</h3>
            {story.description ? <JiraText text={story.description} className="mt-1" /> : <p className="mt-1 text-subtle">None</p>}
          </div>
          <div>
            <h3 className="eyebrow">Acceptance criteria</h3>
            {fromDescription && <p className="mt-1 text-xs text-muted">From the description&apos;s Acceptance criteria section.</p>}
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
          <Link href={`${base}/stories/${row.id}/edit?return=${all ? "refine-all" : "refine"}`} className="btn-secondary btn-sm">
            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
            Edit story
          </Link>
        </section>

        <aside aria-label="Readiness and estimate" className="space-y-5">
          <div className="card space-y-4 p-5">
            <div className="flex items-center gap-3">
              <ScoreRing score={readiness.score} band={readiness.band} size="md" />
              <div className="space-y-1">
                <BandBadge band={readiness.band} />
                <p className="text-xs text-muted">
                  {readiness.findings.length === 0 ? "Every check passed." : `${readiness.findings.length} to fix`}
                </p>
              </div>
            </div>
            {readiness.bandCap && <p className="text-sm text-needs-work">{readiness.bandCap}</p>}
            {readiness.findings.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {readiness.findings.map((f) => (
                  <li key={f.id} className="flex gap-2">
                    <span className="w-8 shrink-0 font-mono text-xs leading-5 text-not-ready">+{f.points}</span>
                    <span className="text-muted">{f.reason}</span>
                  </li>
                ))}
              </ul>
            )}
            <SecondLookList items={looks} compact />
          </div>

          <div className="card space-y-3 p-5">
            <EstimateButtons projectId={project.id} storyId={row.id} points={story.storyPoints} />
            <p className="text-xs text-muted">
              Everyone shows a size at once, testing included. The highest and lowest explain why, then agree. Record the
              agreed size here.
              Bigger than {settingsOf(project).maxPoints}? Split the story instead.
            </p>
          </div>
        </aside>
      </article>

      <nav aria-label="Stories" className="flex items-center justify-between gap-3">
        {prev ? (
          <Link href={prev} className="btn-secondary">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Previous
          </Link>
        ) : (
          <span />
        )}
        <p className="hidden text-xs text-muted sm:block">Arrow keys move between stories; 1, 2, 3, 5 and 8 record an estimate.</p>
        <Link href={next} className="btn-primary">
          {index < list.length - 1 ? "Next story" : "Finish"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </nav>
      <RefineKeys prev={prev} next={next} />
    </div>
  );
}

function RefineHeader({ base }: { base: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Refinement</h1>
        <p className="mt-1 text-sm text-muted">One story at a time: read it together, fix what&apos;s missing, agree a size.</p>
      </div>
      <Link href={base} className="btn-ghost">
        Exit
      </Link>
    </div>
  );
}
