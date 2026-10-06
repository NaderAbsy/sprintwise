import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { SprintReport } from "@/components/sprint-report";
import { db } from "@/lib/server/db";
import { settingsOf, toStory } from "@/lib/server/readiness";
import { doneStatusesOf, loadSprint } from "@/lib/server/sprint";

// Shared links stay out of search engines and never send the token on to other sites.
export const metadata: Metadata = { title: "Shared sprint report", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** A sprint report shared by its owner. Read-only, no account needed, and gone once sharing is turned off. */
export default async function SharedReportPage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  // Tokens are 43 base64url characters; anything else can't match, so skip the query.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const sprint = await db.sprint.findUnique({ where: { shareToken: token }, include: { project: true } });
  if (!sprint) notFound();

  const { baseline, latest, latestRow, log, snapshots } = await loadSprint(sprint, doneStatusesOf(sprint.project));
  if (!baseline || !latest || !latestRow) notFound();

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6">
      <div className="no-print mx-auto mb-6 flex max-w-3xl items-center justify-between">
        <Logo />
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          What is Sprintwise?
        </Link>
      </div>
      <main id="main">
        <SprintReport
          projectName={sprint.project.name}
          sprint={sprint}
          baseline={baseline}
          latest={latest}
          latestAsOf={latestRow.asOfDate}
          log={log}
          settings={settingsOf(sprint.project)}
          doneStatuses={doneStatusesOf(sprint.project)}
          snapshots={snapshots.map((s) => ({ asOfDate: s.asOfDate, items: s.items.map(toStory) }))}
        />
      </main>
    </div>
  );
}
