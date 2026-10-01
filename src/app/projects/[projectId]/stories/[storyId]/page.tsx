import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteStory } from "@/app/projects/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { ReadinessBreakdown } from "@/components/readiness-breakdown";
import { scoreStory } from "@/lib/readiness/rules";
import { db } from "@/lib/server/db";
import { requireProject } from "@/lib/server/dal";
import { settingsOf, toStory } from "@/lib/server/readiness";
import { splitCriteria } from "@/lib/stories/types";

export const metadata: Metadata = { title: "Story" };

export default async function StoryPage({ params }: PageProps<"/projects/[projectId]/stories/[storyId]">) {
  const { projectId, storyId } = await params;
  const project = await requireProject(projectId);
  const row = await db.story.findFirst({ where: { id: storyId, projectId: project.id } });
  if (!row) notFound();

  const story = toStory(row);
  const readiness = scoreStory(story, settingsOf(project));
  const criteria = splitCriteria(story.acceptanceCriteria);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          <Link href={`/projects/${project.id}`} className="hover:underline">
            {project.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">
          <span className="mr-2 font-mono text-base text-muted">{story.key}</span>{" "}
          {story.title}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <ReadinessBreakdown readiness={readiness} />

        <section aria-label="The story" className="card space-y-4 p-5 text-sm">
          <div>
            <h2 className="font-semibold">Description</h2>
            <p className="mt-1 whitespace-pre-wrap text-muted">{story.description || "None"}</p>
          </div>
          <div>
            <h2 className="font-semibold">Acceptance criteria</h2>
            {criteria.length === 0 ? (
              <p className="mt-1 text-muted">None</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                {criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </div>
          <dl className="flex gap-8">
            <div>
              <dt className="font-semibold">Points</dt>
              <dd className="text-muted">{story.storyPoints ?? "Not estimated"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Status</dt>
              <dd className="text-muted">{story.status || "—"}</dd>
            </div>
          </dl>
        </section>
      </div>

      <ConfirmButton
        label="Delete story"
        title={`Delete ${story.key}?`}
        body="This removes the story and its score from the project."
        confirmLabel="Delete story"
        action={deleteStory.bind(null, project.id, row.id)}
      />
    </div>
  );
}
