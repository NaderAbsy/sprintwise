import { notFound } from "next/navigation";
import { ogCard, OG_SIZE } from "@/lib/og-card";
import { db } from "@/lib/server/db";
import { doneStatusesOf, loadSprint } from "@/lib/server/sprint";
import { formatDay } from "@/lib/sprint/dates";
import { computeMetrics, formatPercent } from "@/lib/sprint/metrics";

export const alt = "A shared Sprintwise sprint report";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * The preview of a shared report: the sprint's name and headline numbers, which anyone with the link
 * can already see. Like the page, it's gone once sharing is turned off.
 */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const sprint = await db.sprint.findUnique({ where: { shareToken: token }, include: { project: true } });
  if (!sprint) notFound();
  const doneStatuses = doneStatusesOf(sprint.project);
  const { baseline, latest } = await loadSprint(sprint, doneStatuses);
  if (!baseline || !latest) notFound();
  const m = computeMetrics(baseline, latest, doneStatuses);
  return ogCard({
    eyebrow: "Sprint report",
    title: sprint.name.slice(0, 60),
    subtitle: `${sprint.project.name.slice(0, 50)} · ${formatDay(sprint.startDate)} to ${formatDay(sprint.endDate)}`,
    stats: [
      { label: "Scope change", value: formatPercent(m.netChange, { signed: true }) },
      { label: "Churn", value: formatPercent(m.churn) },
      { label: "Completion", value: formatPercent(m.completion) },
    ],
  });
}
