import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = { title: "Guide" };

const TERMS: [string, string][] = [
  ["Sprint", "A short block of time, usually two weeks, in which the team picks some work and tries to finish it."],
  ["Backlog", "The team's to-do list: everything it might build, in priority order."],
  ["User story", "One item on the backlog, written from the user's side: “As a customer, I want to save my card, so that checkout is faster next time.”"],
  ["Acceptance criteria", "A short checklist that says when a story is done, such as “The card is saved after payment.” One per line."],
  ["Story points", "A rough guess at a story's size. Small is 1 or 2, large is 8 or more. They measure size, not hours."],
  ["Product Owner", "The person who decides what goes on the backlog and in what order, and who writes or approves the stories."],
  ["Commitment", "The stories the team agrees to finish in a sprint, chosen in sprint planning."],
  ["Baseline", "Sprintwise's frozen copy of the commitment, taken on day one. It can't be edited, so every change is measured against it."],
  ["Snapshot", "A later copy of the sprint, taken while it runs. Sprintwise compares it with the baseline, story by story."],
  ["Sprint goal", "One sentence on what the sprint should achieve. At the end, the team records whether it was met."],
  ["Definition of Ready", "The team's agreed list of what a story needs before it can be planned. Sprintwise's rules are a starting point; team checks add your own."],
  ["Jira", "A popular tool for keeping the backlog. Sprintwise doesn't need it: you can type stories in, or upload a CSV exported from Jira or a spreadsheet."],
];

const STEPS = [
  {
    title: "Create a project",
    text: "Sign in with GitHub and create one project per team or backlog.",
  },
  {
    title: "Add your stories",
    text: "Score a story by typing it in; the score updates as you type. Or import a CSV, or load 12 sample stories to practise with.",
  },
  {
    title: "Order the backlog and fix the weakest stories",
    text: "Drag stories into priority order. Then list them weakest first, open a story, read why it lost points, and choose Edit story to fix it; Next to fix takes you to the next one. Aim for Ready (80 or more) before planning.",
  },
  {
    title: "Create a sprint and lock the baseline",
    text: "On day one, create the sprint, write its goal, and tick the stories the team committed to. Sprintwise warns you about stories that aren't Ready and about planning more than the team usually finishes. Locking them makes the baseline.",
  },
  {
    title: "Keep it up to date as the sprint runs",
    text: "Update statuses (To Do, In Progress, Done) and points straight from the backlog or the sprint page. A sprint built from the backlog records each change by itself; one built from CSVs needs a fresh export saved as a snapshot. Tag why each scope change happened: a bug, a stakeholder request, discovered work or tech debt.",
  },
  {
    title: "Open the report for the retrospective",
    text: "One printable page: the goal and whether it was met, how much scope was added or removed and why, churn, completion, and whether the stories that changed scored low before planning. Share a read-only link with stakeholders.",
  },
  {
    title: "Watch the trends",
    text: "After a few sprints, the Trends tab shows velocity, completion, churn and readiness over time, with plain-English insights. The planning helper uses the same velocity.",
  },
];

const NUMBERS: [string, string][] = [
  ["Readiness score", "Out of 100, from nine fixed rules. 80 or more is Ready, 50 to 79 needs work, below 50 isn't ready."],
  ["Net change", "How much bigger or smaller the sprint got. +20% means 20% more work than the team committed to."],
  ["Churn", "How much work moved in, moved out or changed size, even if the total stayed the same. High churn means an unstable sprint."],
  ["Completion", "How much of the original commitment got done. Work added later doesn't count towards it. Which statuses count as done is set in project settings."],
  ["Velocity", "Points of the original commitment the team finished, averaged over the last three sprints. A planning guide, not a target."],
  ["Team checks", "Your own Definition of Ready items, such as “has a design link”. They don't change the score, but a story that fails one can't be Ready."],
];

export default function GuidePage() {
  return (
    <>
      <PageHero eyebrow="Guide" title="How to use Sprintwise">
        <p>Seven steps from a messy backlog to a one-page sprint report, plus every word you&apos;ll meet along the way.</p>
      </PageHero>

      <div className="mx-auto max-w-4xl space-y-20 px-4 py-16 sm:px-6">
        <section aria-labelledby="idea-heading">
          <Reveal>
            <h2 id="idea-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              The idea in one minute
            </h2>
            <div className="mt-4 space-y-3 text-muted">
              <p>
                Teams often start a sprint with stories that are unclear, then the plan changes halfway through and
                nobody can say by how much. Sprintwise helps with both.
              </p>
              <p>
                <strong className="text-foreground">Before the sprint</strong>, it scores each story so you can see
                which ones are clear enough to commit to, and why the others aren&apos;t.{" "}
                <strong className="text-foreground">During and after</strong>, it compares the sprint with what the team
                committed to on day one, so the retrospective can talk about numbers instead of feelings.
              </p>
            </div>
          </Reveal>
        </section>

        <section aria-labelledby="steps-heading">
          <Reveal>
            <h2 id="steps-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Step by step
            </h2>
          </Reveal>
          <ol className="mt-8 space-y-4">
            {STEPS.map((step, i) => (
              <Reveal as="li" key={step.title} delay={i * 60} className="card flex gap-4 p-5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted">{step.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/demo" className="btn-primary">
              Try it in the demo first
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section aria-labelledby="numbers-heading">
          <Reveal>
            <h2 id="numbers-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              What the numbers mean
            </h2>
          </Reveal>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {NUMBERS.map(([term, text], i) => (
              <Reveal key={term} delay={i * 60} className="card p-5">
                <dt className="font-semibold">{term}</dt>
                <dd className="mt-1 text-sm text-muted">{text}</dd>
              </Reveal>
            ))}
          </dl>
        </section>

        <section aria-labelledby="terms-heading">
          <Reveal>
            <h2 id="terms-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Words you&apos;ll see
            </h2>
            <p className="mt-2 text-muted">New to Scrum or Jira? Start here.</p>
          </Reveal>
          <Reveal delay={60} className="card mt-6 divide-y divide-border p-0">
            <dl>
              {TERMS.map(([term, text]) => (
                <div key={term} className="grid gap-1 px-5 py-4 sm:grid-cols-[11rem_1fr] sm:gap-4">
                  <dt className="font-medium">{term}</dt>
                  <dd className="text-sm text-muted">{text}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>
      </div>
    </>
  );
}
