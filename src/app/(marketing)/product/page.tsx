import { ArrowRight, BarChart3, ClipboardCheck, KeyRound, Printer, Settings2, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";
import { RULES } from "@/lib/readiness/rules";

export const metadata: Metadata = { title: "Product" };

/** How each rule is checked, in the words the app uses when a rule fails. */
const HOW: Record<string, string> = {
  C1: "One criterion per line, and more for bigger stories: 1 up to 3 points, 2 from 5 points, 3 from 13. Leading dashes, bullets and numbers are ignored. Criteria under an \u201cAcceptance criteria\u201d heading in the description count too, for Jira projects without a separate field.",
  C2: "The title or description reads “As a … I want … so that …”, in that order, and names who it's for. “As a user” could be anyone, so it doesn't count.",
  C3: "The criteria contain none of the project's vague words, such as works or properly, so each one can be tested.",
  C4: "There's something after “so that”: what the user gains.",
  C5: "The title and description avoid words like fast, easy, better and user-friendly.",
  C6: "The story has story points. A story that isn't estimated can't be Ready.",
  C7: "No more than the project's maximum points (8 by default). A bigger story can't be Ready.",
  C8: "One “I want” and no “and also”, which usually joins two features.",
  C9: "A description of at least 20 characters.",
};

const METRICS = [
  { name: "Net change", formula: "(latest points − committed points) ÷ committed points", note: "How much bigger or smaller the sprint got." },
  { name: "Churn", formula: "(added + removed + re-estimated points) ÷ committed points", note: "How much moved, even when the total didn't." },
  { name: "Completion", formula: "points done from the original commitment ÷ committed points", note: "Stories added later don't count towards it." },
];

const SECTIONS = [
  { id: "readiness", label: "Readiness check", Icon: ClipboardCheck },
  { id: "rules", label: "The nine rules", Icon: Settings2 },
  { id: "scope", label: "Scope tracking", Icon: BarChart3 },
  { id: "report", label: "Sprint report", Icon: Printer },
  { id: "team", label: "Refinement and Jira", Icon: Users },
  { id: "planning", label: "Planning and trends", Icon: TrendingUp },
  { id: "privacy", label: "Accounts and data", Icon: KeyRound },
];

export default function ProductPage() {
  return (
    <>
      <PageHero eyebrow="Product" title="Everything Sprintwise does, and how">
        <p>A readiness check before planning, scope tracking during the sprint, and a one-page report after it.</p>
      </PageHero>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {SECTIONS.map(({ id, label, Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-foreground lg:border-transparent"
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-20">
          <section id="readiness" aria-labelledby="readiness-heading" className="scroll-mt-24">
            <Reveal>
              <h2 id="readiness-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Readiness check
              </h2>
              <div className="mt-4 space-y-3 text-muted">
                <p>
                  Paste a story or import a CSV, and each story gets a score out of 100 from nine fixed rules. No AI sets
                  the score: the same story always gets the same number, and every lost point comes with a reason.
                </p>
                <p>
                  It also flags signs of an AI draft pasted without a careful read, such as chat leftovers
                  (&ldquo;Certainly! Here&apos;s…&rdquo;), unfilled placeholders and criteria that would fit any story,
                  as worth a second look. Leftovers and placeholders keep a story from being Ready.
                </p>
                <p>
                  The backlog keeps your priority order, which you set by dragging. You can also list it weakest first,
                  search it, filter it by band, status, epic or type, and change several stories at once.
                </p>
              </div>
            </Reveal>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Ready", "80 or more", "bg-ready-bg text-ready"],
                ["Needs work", "50 to 79", "bg-needs-work-bg text-needs-work"],
                ["Not ready", "Below 50", "bg-not-ready-bg text-not-ready"],
              ].map(([band, range, style], i) => (
                <Reveal key={band} delay={i * 80}>
                  <div className={`rounded-xl p-4 ${style}`}>
                    <p className="font-semibold">{band}</p>
                    <p className="text-sm">{range}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section id="rules" aria-labelledby="rules-heading" className="scroll-mt-24">
            <Reveal>
              <h2 id="rules-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                The nine rules
              </h2>
              <p className="mt-4 text-muted">
                Each project can change the maximum story size and the vague-word list. Saving the settings re-scores every
                story. When one missing thing fails two rules, such as no criteria (so nothing to test), it shows as one
                reason with both rules&apos; points.
              </p>
            </Reveal>
            <Reveal delay={80} className="card mt-6 overflow-x-auto p-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Rule</th>
                    <th scope="col">Check</th>
                    <th scope="col">How it&apos;s checked</th>
                    <th scope="col" className="text-right">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {RULES.map((rule) => (
                    <tr key={rule.id}>
                      <td className="font-mono text-xs text-subtle">{rule.id}</td>
                      <td className="font-medium">{rule.check}</td>
                      <td className="text-muted">{HOW[rule.id]}</td>
                      <td className="text-right tabular-nums">{rule.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </section>

          <section id="scope" aria-labelledby="scope-heading" className="scroll-mt-24">
            <Reveal>
              <h2 id="scope-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Scope tracking
              </h2>
              <p className="mt-4 text-muted">
                On day one, tick the stories the team committed to (or upload them as a CSV) and lock them as the
                baseline; it can&apos;t be edited. A sprint picked from the backlog records every status and estimate
                change by itself; one built from CSVs takes a new upload as a snapshot. Stories are matched by key, so a
                renamed story isn&apos;t counted as removed and added, and every change goes in a dated log.
              </p>
            </Reveal>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {METRICS.map((m, i) => (
                <Reveal key={m.name} delay={i * 80}>
                  <div className="card h-full p-5">
                    <p className="font-semibold">{m.name}</p>
                    <p className="mt-2 font-mono text-xs text-accent">{m.formula}</p>
                    <p className="mt-3 text-sm text-muted">{m.note}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section id="report" aria-labelledby="report-heading" className="scroll-mt-24">
            <Reveal>
              <h2 id="report-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Sprint report
              </h2>
              <p className="mt-4 text-muted">
                One printable A4 page for the retrospective: the sprint goal and whether it was met, the metrics, why scope
                changed (bugs, stakeholder requests, discovered work, tech debt), the change log, and one plain sentence on
                whether the stories that changed scored lower before planning. Share it with stakeholders through a
                read-only link you can turn off at any time.
              </p>
              <Link href="/demo/report" className="btn-secondary mt-5">
                See the sample report
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Reveal>
          </section>

          <section id="team" aria-labelledby="team-heading" className="scroll-mt-24">
            <Reveal>
              <h2 id="team-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Refinement and Jira
              </h2>
              <ul className="mt-4 space-y-2 text-muted">
                <li>
                  <strong className="text-foreground">Refinement mode:</strong> one story at a time on the meeting
                  screen, with what&apos;s missing. Fix it together, agree a size and record it in one click.
                </li>
                <li>
                  <strong className="text-foreground">Share the backlog:</strong> a read-only link to the unfinished
                  stories and their scores, so people can read ahead. Turn it off at any time.
                </li>
                <li>
                  <strong className="text-foreground">Connect Jira Cloud:</strong> import straight from a Jira search,
                  sync with one click, and send your edits back. Sprintwise writes to Jira only when you click Send.
                </li>
              </ul>
            </Reveal>
          </section>

          <section id="planning" aria-labelledby="planning-heading" className="scroll-mt-24">
            <Reveal>
              <h2 id="planning-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Planning and trends
              </h2>
              <ul className="mt-4 space-y-2 text-muted">
                <li>
                  <strong className="text-foreground">Planning helper:</strong> while you pick the sprint, it shows each
                  story&apos;s readiness, the team&apos;s usual velocity next to your total, and a warning before you commit
                  stories that aren&apos;t Ready.
                </li>
                <li>
                  <strong className="text-foreground">Trends:</strong> velocity, completion, churn and readiness at planning
                  across every sprint, with plain-English insights such as whether more Ready sprints finished more.
                </li>
                <li>
                  <strong className="text-foreground">Team checks:</strong> add your own Definition of Ready items; a story
                  that fails one can&apos;t be Ready.
                </li>
                <li>
                  <strong className="text-foreground">Writing help:</strong> a story template, Given / When / Then starters,
                  measurable alternatives to vague words, and ways to split big stories. No AI needed.
                </li>
                <li>
                  <strong className="text-foreground">Export:</strong> download the scored backlog as a CSV, or copy any
                  story as text for Jira or Slack.
                </li>
              </ul>
              <Link href="/demo#trends" className="btn-secondary mt-5">
                See trends in the demo
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Reveal>
          </section>

          <section id="privacy" aria-labelledby="privacy-heading" className="scroll-mt-24">
            <Reveal>
              <h2 id="privacy-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Accounts and data
              </h2>
              <ul className="mt-4 space-y-2 text-muted">
                <li>The demo runs in your browser with invented data and saves nothing.</li>
                <li>Sign in with GitHub to keep projects. Deleting your account deletes everything in it.</li>
                <li>Usage counts are anonymous: no user ID and no story text.</li>
                <li>Light, dark and system themes, WCAG 2.2 AA contrast, and fully usable by keyboard.</li>
              </ul>
              <Link href="/privacy" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
                Read the privacy page
              </Link>
            </Reveal>
          </section>
        </div>
      </div>
    </>
  );
}
