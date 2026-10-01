import type { Metadata } from "next";
import Link from "next/link";
import { ProjectSettings } from "@/app/projects/_components/project-forms";
import { BandBadge } from "@/components/band-badge";
import type { Band } from "@/lib/readiness/rules";
import { db } from "@/lib/server/db";
import { requireProject } from "@/lib/server/dal";
import { formatDay } from "@/lib/sprint/dates";

const FILTERS: { slug: string; band: Band }[] = [
  { slug: "ready", band: "Ready" },
  { slug: "needs-work", band: "Needs work" },
  { slug: "not-ready", band: "Not ready" },
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

  const [stories, sprints] = await Promise.all([
    db.story.findMany({ where: { projectId: project.id }, include: { readiness: true } }),
    db.sprint.findMany({
      where: { projectId: project.id },
      orderBy: { startDate: "desc" },
      include: { snapshots: { select: { id: true } } },
    }),
  ]);
  // Lowest score first, so the weakest stories get fixed first (story R-3).
  stories.sort((a, b) => (a.readiness?.score ?? 0) - (b.readiness?.score ?? 0) || a.key.localeCompare(b.key));
  const ready = stories.filter((s) => s.readiness?.band === "Ready").length;
  const shown = filter ? stories.filter((s) => s.readiness?.band === filter.band) : stories;
  const base = `/projects/${project.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            <Link href="/projects" className="hover:underline">
              Projects
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {stories.length > 0 && (
            <p className="mt-1 text-muted">
              {ready} of {stories.length} {stories.length === 1 ? "story" : "stories"} ready
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/stories/new`} className="btn-primary">
            Score a story
          </Link>
          <Link href={`${base}/import`} className="btn-secondary">
            Import CSV
          </Link>
        </div>
      </div>

      {imported && (
        <p role="status" className="rounded-md bg-ready-bg px-3 py-2 text-sm text-ready">
          Imported and scored {imported} {imported === "1" ? "story" : "stories"}.
        </p>
      )}

      {stories.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium">No stories yet.</p>
          <p className="mt-1 text-sm text-muted">Score one story by pasting it, or import your backlog from a CSV.</p>
        </div>
      ) : (
        <>
          <nav aria-label="Filter by band" className="flex flex-wrap gap-2 text-sm">
            <FilterLink href={base} active={!filter}>
              All ({stories.length})
            </FilterLink>
            {FILTERS.map((f) => (
              <FilterLink key={f.slug} href={`${base}?band=${f.slug}`} active={filter?.slug === f.slug}>
                {f.band} ({stories.filter((s) => s.readiness?.band === f.band).length})
              </FilterLink>
            ))}
          </nav>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Stories sorted by readiness score, lowest first</caption>
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Score</th>
                  <th scope="col" className="px-4 py-2 font-medium">Band</th>
                  <th scope="col" className="px-4 py-2 font-medium">Key</th>
                  <th scope="col" className="px-4 py-2 font-medium">Title</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((story) => (
                  <tr key={story.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-semibold tabular-nums">{story.readiness?.score ?? "—"}</td>
                    <td className="px-4 py-2">{story.readiness && <BandBadge band={story.readiness.band as Band} />}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{story.key}</td>
                    <td className="px-4 py-2">
                      <Link href={`${base}/stories/${story.id}`} className="hover:underline">
                        {story.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{story.storyPoints ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <p className="p-4 text-sm text-muted">No stories in this band.</p>}
          </div>
        </>
      )}

      <section aria-labelledby="sprints-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sprints-heading" className="text-lg font-semibold">
            Sprints
          </h2>
          <Link href={`${base}/sprints/new`} className="btn-secondary">
            New sprint
          </Link>
        </div>
        {sprints.length === 0 ? (
          <p className="text-sm text-muted">
            No sprints yet. Create one to lock a baseline and track how much it changes.
          </p>
        ) : (
          <ul className="card divide-y divide-border text-sm">
            {sprints.map((sprint) => (
              <li key={sprint.id}>
                <Link href={`${base}/sprints/${sprint.id}`} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 hover:bg-background">
                  <span className="font-medium">{sprint.name}</span>
                  <span className="text-muted">
                    {formatDay(sprint.startDate)} to {formatDay(sprint.endDate)}
                  </span>
                  <span className="text-muted">
                    {sprint.snapshots.length === 0
                      ? "No baseline yet"
                      : `${sprint.snapshots.length} ${sprint.snapshots.length === 1 ? "snapshot" : "snapshots"}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="card p-5">
        <summary className="cursor-pointer font-medium">Project settings</summary>
        <div className="mt-4">
          <ProjectSettings projectId={project.id} name={project.name} />
        </div>
      </details>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1 ${active ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent"}`}
    >
      {children}
    </Link>
  );
}
