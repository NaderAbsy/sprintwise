import { CircleCheck, CircleDashed, CircleX, Download, FileUp, ListChecks, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addSampleStories } from "@/app/projects/actions";
import { GettingStarted } from "@/app/projects/_components/getting-started";
import { QuickField, StatusOptions } from "@/app/projects/_components/quick-field";
import { BandBadge } from "@/components/band-badge";
import { EmptyState } from "@/components/empty-state";
import { ScoreRing } from "@/components/score-ring";
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
  const { band: bandParam, imported } = await searchParams;
  const project = await requireProject(projectId);
  const filter = FILTERS.find((f) => f.slug === bandParam);
  const base = `/projects/${project.id}`;
  await refreshStaleScores([project.id]);

  const [stories, latestSprint] = await Promise.all([
    db.story.findMany({ where: { projectId: project.id }, include: { readiness: true } }),
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
  // Lowest score first, so the weakest stories get fixed first (story R-3).
  stories.sort((a, b) => (a.readiness?.score ?? 0) - (b.readiness?.score ?? 0) || a.key.localeCompare(b.key));
  const count = (band: Band) => stories.filter((s) => s.readiness?.band === band).length;
  const ready = count("Ready");
  const shown = filter ? stories.filter((s) => s.readiness?.band === filter.band) : stories;
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
            ? `${ready} of ${stories.length} ${stories.length === 1 ? "story" : "stories"} ready. Weakest first, so you know what to fix before planning.`
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
          <nav aria-label="Filter by band" className="grid gap-3 sm:grid-cols-4">
            <FilterCard href={base} active={!filter} label="All" value={stories.length} />
            {FILTERS.map((f) => (
              <FilterCard
                key={f.slug}
                href={`${base}?band=${f.slug}`}
                active={filter?.slug === f.slug}
                label={f.band}
                value={count(f.band)}
                icon={<f.Icon aria-hidden="true" className={`h-4 w-4 ${f.tone}`} />}
              />
            ))}
          </nav>

          <StatusOptions id="quick-status-options" doneStatuses={doneStatusesOf(project)} />
          <div className="card overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Stories sorted by readiness score, lowest first</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-16">Score</th>
                  <th scope="col">Story</th>
                  {/* On phones the score ring's colour shows the band, and points are edited on the story. */}
                  <th scope="col" className="hidden w-32 sm:table-cell">Band</th>
                  <th scope="col" className="w-40">Status</th>
                  <th scope="col" className="hidden w-24 sm:table-cell">Points</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((story) => (
                  <tr key={story.id}>
                    <td>{story.readiness && <ScoreRing score={story.readiness.score} band={story.readiness.band as Band} size="sm" />}</td>
                    <td>
                      <Link href={`${base}/stories/${story.id}`} className="group block">
                        <span className="font-mono text-xs text-subtle">{story.key}</span>{" "}
                        <span className="font-medium group-hover:text-accent group-hover:underline">{story.title}</span>
                      </Link>
                    </td>
                    <td className="hidden sm:table-cell">{story.readiness && <BandBadge band={story.readiness.band as Band} />}</td>
                    <td>
                      <QuickField
                        projectId={project.id}
                        storyId={story.id}
                        storyKey={story.key}
                        field="status"
                        value={story.status}
                        listId="quick-status-options"
                      />
                    </td>
                    <td className="hidden sm:table-cell">
                      <QuickField
                        projectId={project.id}
                        storyId={story.id}
                        storyKey={story.key}
                        field="storyPoints"
                        value={story.storyPoints === null ? "" : String(story.storyPoints)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">No stories in this band.</p>}
          </div>
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
