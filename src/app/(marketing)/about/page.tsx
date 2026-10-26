import { ArrowRight, BookOpen, CheckCircle2, Code2, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CountUp } from "@/components/marketing/count-up";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";
import { GITHUB_URL, RELEASES } from "@/lib/site";
import { pageMeta } from "@/lib/page-meta";

export const metadata: Metadata = pageMeta("/about", "About", "Why Sprintwise exists, who it is for, and how it is run: free, code you can read on GitHub, fixed rules, no AI reading your tickets.");

const PRINCIPLES = [
  {
    Icon: CheckCircle2,
    title: "Explainable over clever",
    text: "Fixed rules, not a model, set the score. A Product Owner can defend every number in a refinement meeting.",
  },
  {
    Icon: BookOpen,
    title: "Decisions written down",
    text: "Each product decision has its date, the options considered and the reason, in DECISIONS.md.",
  },
  {
    Icon: FlaskConical,
    title: "Tested like a product",
    text: "Every rule and metric has unit tests. End-to-end tests cover accessibility, keyboard-only use and the one-page report.",
  },
];

const STACK = ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS 4", "PostgreSQL", "Prisma 7", "Better Auth", "Vitest", "Playwright", "Vercel", "Neon"];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title="Built by a Product Owner, for Product Owners">
        <p>
          Sprintwise started from two questions every sprint review circles back to: were our stories ready, and did we
          stick to what we committed? Both are hard to answer with data.
        </p>
      </PageHero>

      <section aria-labelledby="story-heading" className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <h2 id="story-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            The project
          </h2>
          <div className="mt-4 space-y-3 text-muted">
            <p>
              Sprintwise is an independent project, run like a product: a public backlog, a log of every product decision
              and why, and automated tests on every release before it goes live.
            </p>
            <p>
              Version 2 added refinement mode, shared backlogs and a live Jira connection with a nightly sync. AI rewrites
              are built but switched off on the live site, so no story text is ever sent to an AI service.
            </p>
            <p>Every story, number and team name in the demo is invented.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={GITHUB_URL} className="btn-primary">
              <Code2 aria-hidden="true" className="h-4 w-4" />
              Code on GitHub
            </a>
            <Link href="/changelog" className="btn-secondary">
              Read the changelog
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <dl className="grid grid-cols-2 gap-3">
            {[
              { value: 0, label: "cost to use, and no ads" },
              { value: RELEASES.length, label: "releases" },
              { value: 9, label: "readiness rules" },
              { value: 2, label: "themes, both WCAG AA" },
            ].map((stat) => (
              <div key={stat.label} className="card flex flex-col p-5">
                <dt className="text-sm text-muted">{stat.label}</dt>
                <dd className="order-first text-4xl font-semibold tracking-tight tabular-nums">
                  <CountUp value={stat.value} />
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      <section aria-labelledby="principles-heading" className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="principles-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How it was built
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map(({ Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 100}>
                <div className="card h-full p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="stack-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="stack-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Built with
        </h2>
        <ul className="mt-6 flex flex-wrap gap-2">
          {STACK.map((tech, i) => (
            <Reveal as="li" key={tech} delay={i * 40}>
              <span className="inline-block rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-accent">
                {tech}
              </span>
            </Reveal>
          ))}
        </ul>
      </section>
    </>
  );
}
