import { CircleCheck, CircleDashed, CircleX, Download, FileUp, ListChecks, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addSampleStories, disableBacklogShare, enableBacklogShare } from "@/app/projects/actions";
import { ShareLink } from "@/app/projects/_components/share-link";
import { GettingStarted } from "@/app/projects/_components/getting-started";
import { BacklogTable } from "@/app/projects/_components/backlog-table";
import { BacklogToolbar, NO_STATUS } from "@/app/projects/_components/backlog-toolbar";
import { StatusOptions } from "@/app/projects/_components/quick-field";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import type { Band } from "@/lib/readiness/rules";
import { db } from "@/lib/server/db";
import { requireProject } from "@/lib/server/dal";
import { refreshStaleScores } from "@/lib/server/readiness";
import { doneStatusesOf } from "@/lib/server/sprint";
import { isDone } from "@/lib/sprint/metrics";
import { secondLook } from "@/lib/readiness/second-look";

const FILTERS: { slug: string; band: Band; Icon: typeof CircleCheck; tone: string }[] = [
  { slug: "ready", band: "Ready", Icon: CircleCheck, tone: "text-ready-dot" },
  { slug: "needs-work", band: "Needs work", Icon: CircleDashed, tone: "text-needs-work-dot" },
  { slug: "not-ready", band: "Not ready", Icon: CircleX, tone: "text-not-ready-dot" },
];

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]">): Promise<Metadata> {
  const project = await requireProject((await params).projectId);
  return { title: project.name };
}

export default async function BacklogPage({ params, searchParams }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { band: bandParam, imported, q: qParam, status: statusParam, sort: sortParam, epic: epicParam, type: typeParam, finished: finishedParam, edited: editedParam, look: lookParam } =
    await searchParams;
  const text = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim().slice(0, 100) : "");
  const q = text(qParam);
  const statusFilter = text(statusParam);
  const epicFilter = typeof epicParam === "string" ? epicParam.trim().slice(0, 200) : "";
  const typeFilter = text(typeParam);
  const editedOnly = editedParam === "1";
  const lookOnly = lookParam === "1";
  const sort = sortParam === "weakest" ? "weakest" : "priority";
  const project = await requireProject(projectId);
  const filter = FILTERS.find((f) => f.slug === bandParam);
  const base = `/projects/${project.id}`;
  await refreshStaleScores([project.id]);

  const [stories, latestSprint] = await Promise.all([
    db.story.findMany({
      where: { projectId: project.id },
      include: { readiness: true },
      orderBy: [{ rank: "asc" }, { key: "asc" }],
    }),
    db.sprint.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      include: { snapshots: { select: { isBaseline: true } } },
    }),
  ]);
  const progress = {
    stories: stories.length,
    sprintId: latestSprint?.id ?? null,
    baselineLocked: latestSprint?.snapshots.some((s) => s.isBaseline) ?? false,
    snapshotSaved: latestSprint?.snapshots.some((s) => !s.isBaseline) ?? false,
  };
  // Finished stories need no readiness check: they're left out of the counts and hidden unless asked for.
  const doneStatuses = doneStatusesOf(project);
  const finished = (s: (typeof stories)[number]) => isDone(s.status, doneStatuses);
  const active = stories.filter((s) => !finished(s));
  const finishedCount = stories.length - active.length;
  const showFinished = finishedParam === "show" || (statusFilter !== "" && isDone(statusFilter, doneStatuses));
  const count = (band: Band) => active.filter((s) => s.readiness?.band === band).length;
  const ready = count("Ready");
  const typeOf = (s: (typeof stories)[number]) => s.issueType || "Story";
  const editedCount = stories.filter((s) => s.editedAt).length;
  // Signs of a pasted AI draft: not scored, but worth listing.
  const needsLook = new Set(active.filter((s) => secondLook(s).length > 0).map((s) => s.id));

  // Priority order by default; "weakest first" lists the lowest scores first, so they get fixed (story R-3).
  const needle = q.toLowerCase();
  const shown = (showFinished ? stories : active)
    .filter((s) => !filter || s.readiness?.band === filter.band)
    .filter((s) => !needle || s.key.toLowerCase().includes(needle) || s.title.toLowerCase().includes(needle))
    .filter((s) =>
      !statusFilter
        ? true
        : statusFilter === NO_STATUS
          ? s.status.trim() === ""
          : s.status.trim().toLowerCase() === statusFilter.toLowerCase(),
    )
    .filter((s) => !epicFilter || s.epic === epicFilter)
    .filter((s) => !typeFilter || typeOf(s) === typeFilter)
    .filter((s) => !editedOnly || s.editedAt)
    .filter((s) => !lookOnly || needsLook.has(s.id));
  if (sort === "weakest") shown.sort((a, b) => (a.readiness?.score ?? 0) - (b.readiness?.score ?? 0) || a.rank - b.rank);
  const filtered = Boolean(filter || q || statusFilter || epicFilter || typeFilter || editedOnly || lookOnly);
  const statuses = [
    ...new Set(stories.map((s) => s.status.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  if (stories.some((s) => s.status.trim() === "")) statuses.push(NO_STATUS);
  const epics = [...new Set(stories.map((s) => s.epic).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const types = stories.some((s) => s.issueType) ? [...new Set(stories.map(typeOf))].sort((a, b) => a.localeCompare(b)) : [];
  // Links keep the search, status and order; only the band changes.
  const view = (band?: string) => {
    const params = new URLSearchParams();
    if (band) params.set("band", band);
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    if (epicFilter) params.set("epic", epicFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (editedOnly) params.set("edited", "1");
    if (lookOnly) params.set("look", "1");
    if (finishedParam === "show") params.set("finished", "show");
    if (sort !== "priority") params.set("sort", sort);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };
  // Flips one switch in the current view's address, keeping the rest.
  const toggle = (name: "finished" | "edited" | "look", on: string) => {
    const url = new URL(view(filter?.slug), "http://x");
    if (url.searchParams.get(name) === on) url.searchParams.delete(name);
    else url.searchParams.set(name, on);
    const query = url.searchParams.toString();
    return query ? `${base}?${query}` : base;
  };
  const actions = (
    <>
      {stories.length > 0 && (
        <a href={`${base}/export.csv`} className="btn-ghost" download>
          <Download aria-hidden="true" className="h-4 w-4" />
          Export CSV
        </a>
      )}
      <ShareLink
        token={project.shareToken}
        path="/share/backlog"
        title="Share this backlog"
        description="Anyone with the link can view the unfinished stories, read-only and without an account: titles, descriptions, acceptance criteria, scores, statuses and points. Not your sprints, settings or other projects. Turn the link off at any time."
        enable={enableBacklogShare.bind(null, project.id)}
        disable={disableBacklogShare.bind(null, project.id)}
      />
      <Link href={`${base}/import`} className="btn-secondary">
        <FileUp aria-hidden="true" className="h-4 w-4" />
        Import CSV
      </Link>
      <Link href={`${base}/stories/new`} className="btn-primary">
        <Plus aria-hidden="true" className="h-4 w-4" />
        Score a story
      </Link>
    </>
  );

  return (
    <>
      <SectionHeader
        title="Backlog"
        description={
          stories.length > 0
            ? `${ready} of ${active.length} ${active.length === 1 ? "story" : "stories"} ready${
                finishedCount > 0 ? ` (${finishedCount} finished not counted)` : ""
              }. Order them by priority, or list the weakest first to see what to fix before planning.`
            : "Score stories to see which are ready for planning."
        }
        actions={stories.length > 0 ? actions : undefined}
      />

      <GettingStarted base={base} progress={progress} />

      {imported && (
        <p role="status" className="mb-4 rounded-lg bg-ready-bg px-4 py-2.5 text-sm text-ready">
          Imported and scored {imported} {imported === "1" ? "story" : "stories"}.
        </p>
      )}

      {stories.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No stories yet."
          action={
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-2">{actions}</div>
              <form action={addSampleStories.bind(null, project.id)}>
                <button className="btn-ghost btn-sm">
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  Or load 12 sample stories to try it out
                </button>
              </form>
            </div>
          }
        >
          Paste one story to score it, or bring in your whole backlog. Sample stories are invented, and you can delete
          them any time.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <BacklogToolbar
            action={base}
            q={q}
            status={statusFilter}
            sort={sort}
            band={filter?.slug}
            statuses={statuses}
            epic={epicFilter}
            epics={epics}
            type={typeFilter}
            types={types}
            finished={finishedParam === "show" ? "show" : ""}
            edited={editedOnly}
            look={lookOnly}
          />
          <nav aria-label="Filter by band" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FilterCard href={view()} active={!filter} label="All" value={active.length} />
            {FILTERS.map((f) => (
              <FilterCard
                key={f.slug}
                href={view(f.slug)}
                active={filter?.slug === f.slug}
                label={f.band}
                value={count(f.band)}
                icon={<f.Icon aria-hidden="true" className={`h-4 w-4 ${f.tone}`} />}
              />
            ))}
          </nav>

          {(filtered || finishedCount > 0 || editedCount > 0 || needsLook.size > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              {filtered && (
                <p className="flex flex-wrap items-center gap-2">
                  Showing {shown.length} of {stories.length} {stories.length === 1 ? "story" : "stories"}.
                  <Link href={sort === "priority" ? base : `${base}?sort=${sort}`} className="text-accent underline underline-offset-2">
                    Clear filters
                  </Link>
                </p>
              )}
              {finishedCount > 0 && !(statusFilter && isDone(statusFilter, doneStatuses)) && (
                <Link href={toggle("finished", "show")} className="text-accent underline underline-offset-2">
                  {finishedParam === "show" ? `Hide ${finishedCount} finished` : `Show ${finishedCount} finished`}
                </Link>
              )}
              {needsLook.size > 0 && (
                <Link href={toggle("look", "1")} className="text-accent underline underline-offset-2">
                  {lookOnly ? "Show all, not only second looks" : `${needsLook.size} worth a second look`}
                </Link>
              )}
              {editedCount > 0 && (
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={toggle("edited", "1")} className="text-accent underline underline-offset-2">
                    {editedOnly ? "Show all, not only edited" : `${editedCount} edited here, not yet in Jira`}
                  </Link>
                  <a href={`${base}/jira.csv`} download className="text-accent underline underline-offset-2">
                    Download them for Jira
                  </a>
                </span>
              )}
            </div>
          )}

          <StatusOptions id="quick-status-options" doneStatuses={doneStatusesOf(project)} />
          <BacklogTable
            projectId={project.id}
            reorderable={sort === "priority" && !filtered}
            withFinished={showFinished}
            caption={sort === "priority" ? "Stories in priority order" : "Stories sorted by readiness score, lowest first"}
            statusListId="quick-status-options"
            rows={shown.map((s) => ({
              id: s.id,
              key: s.key,
              title: s.title,
              epic: s.epic,
              issueType: s.issueType,
              edited: Boolean(s.editedAt),
              secondLook: needsLook.has(s.id),
              status: s.status,
              storyPoints: s.storyPoints,
              score: s.readiness?.score ?? null,
              band: (s.readiness?.band as Band | undefined) ?? null,
            }))}
          />
        </div>
      )}
    </>
  );
}

function FilterCard({
  href,
  active,
  label,
  value,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`card flex items-center justify-between px-4 py-3 transition-colors ${
        active ? "border-accent ring-1 ring-accent" : "hover:border-border-strong"
      }`}
    >
      <span className="flex items-center gap-2 text-sm text-muted">
        {icon}
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </Link>
  );
}
