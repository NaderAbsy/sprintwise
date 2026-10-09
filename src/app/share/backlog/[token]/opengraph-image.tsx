import { notFound } from "next/navigation";
import { ogCard, OG_SIZE } from "@/lib/og-card";
import { scoreStory } from "@/lib/readiness/rules";
import { db } from "@/lib/server/db";
import { settingsOf, toStory } from "@/lib/server/readiness";
import { doneStatusesOf } from "@/lib/server/sprint";
import { isDone } from "@/lib/sprint/metrics";

export const alt = "A shared Sprintwise backlog";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The preview of a shared backlog: its name and how many unfinished stories are ready. Gone once sharing is off. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const project = await db.project.findUnique({ where: { shareToken: token } });
  if (!project) notFound();
  const settings = settingsOf(project);
  const doneStatuses = doneStatusesOf(project);
  const rows = await db.story.findMany({ where: { projectId: project.id } });
  const bands = rows.filter((r) => !isDone(r.status, doneStatuses)).map((r) => scoreStory(toStory(r), settings).band);
  const count = (band: string) => String(bands.filter((b) => b === band).length);
  return ogCard({
    eyebrow: "Backlog for refinement",
    title: project.name.slice(0, 60),
    subtitle: `${count("Ready")} of ${bands.length} unfinished ${bands.length === 1 ? "story" : "stories"} ready for planning`,
    stats: [
      { label: "Ready", value: count("Ready") },
      { label: "Needs work", value: count("Needs work") },
      { label: "Not ready", value: count("Not ready") },
    ],
  });
}
