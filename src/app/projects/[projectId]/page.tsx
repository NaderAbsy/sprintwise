import { CircleCheck, CircleDashed, CircleX, Download, FileUp, ListChecks, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addSampleStories } from "@/app/projects/actions";
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
  const { band: bandParam, imported, q: qParam, status: statusParam, sort: sortParam } = await searchParams;
  const text = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim().slice(0, 100) : "");
  const q = text(qParam);
  const statusFilter = text(statusParam);
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
  const count = (band: Band) => stories.filter((s) => s.readiness?.band === band).length;
  const ready = count("Ready");

  // Priority order by default; "weakest first" lists the lowest scores first, so they get fixed (story R-3).
  const needle = q.toLowerCase();
  const shown = stories
    .filter((s) => !filter || s.readiness?.band === filter.band)
    .filter((s) => !needle || s.key.toLowerCase().includes(needle) || s.title.toLowerCase().includes(needle))
    .filter((s) =>
      !statusFilter
        ? true
        : statusFilter === NO_STATUS
          ? s.status.trim() === ""
          : s.status.trim().toLowerCase() === statusFilter.toLowerCase(),
    );
  if (sort === "weakest") shown.sort((a, b) => (a.readiness?.score ?? 0) - (b.readiness?.score ?? 0) || a.rank - b.rank);
  const filtered = Boolean(filter || q || statusFilter);
  const statuses = [
    ...new Set(stories.map((s) => s.status.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  if (stories.some((s) => s.status.trim() === "")) statuses.push(NO_STATUS);
  // Links keep the search, status and order; only the band changes.
  const view = (band?: string) => {
    const params = new URLSearchParams();
    if (band) params.set("band", band);
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    if (sort !== "priority") params.set("sort", sort);
    const query = params.toString();
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
            ? `${ready} of ${stories.length} ${stories.length === 1 ? "story" : "stories"} ready. Order them by priority, or list the weakest first to see what to fix before planning.`
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
          />
          <nav aria-label="Filter by band" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FilterCard href={view()} active={!filter} label="All" value={stories.length} />
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

          {filtered && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              Showing {shown.length} of {stories.length} {stories.length === 1 ? "story" : "stories"}.
              <Link href={sort === "priority" ? base : `${base}?sort=${sort}`} className="text-accent underline underline-offset-2">
                Clear filters
              </Link>
            </p>
          )}

          <StatusOptions id="quick-status-options" doneStatuses={doneStatusesOf(project)} />
          <BacklogTable
            projectId={project.id}
            reorderable={sort === "priority" && !filtered}
            caption={sort === "priority" ? "Stories in priority order" : "Stories sorted by readiness score, lowest first"}
            statusListId="quick-status-options"
            rows={shown.map((s) => ({
              id: s.id,
              key: s.key,
              title: s.title,
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
