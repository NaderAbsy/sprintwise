import { ArrowRight, ChevronDown, ClipboardCheck, Code2, FileSpreadsheet, Lock, Printer } from "lucide-react";
import Link from "next/link";
import { SignInButton } from "@/components/auth-buttons";
import { BandBadge } from "@/components/band-badge";
import { CountUp } from "@/components/marketing/count-up";
import { DemoVideo } from "@/components/marketing/demo-video";
import { FeatureTabs, type FeatureTab } from "@/components/marketing/feature-tabs";
import { HeroScorer } from "@/components/marketing/hero-scorer";
import { Reveal } from "@/components/marketing/reveal";
import { SpotlightGrid } from "@/components/marketing/spotlight";
import { ScoreRing } from "@/components/score-ring";
import { demoBacklog } from "@/demo/backlog";
import { demoSprint } from "@/demo/sprint";
import videoLines from "@/demo/video-lines.json";
import { DEFAULT_SETTINGS, RULES, scoreStory } from "@/lib/readiness/rules";
import { computeMetrics, formatPercent } from "@/lib/sprint/metrics";
import { compareReadiness, readinessFinding } from "@/lib/sprint/report";
import { getSession } from "@/lib/server/dal";
import { GITHUB_URL, RELEASES } from "@/lib/site";

const STEPS = [
  {
    Icon: ClipboardCheck,
    title: "Score every story",
    text: "Paste a story or upload a CSV. Nine fixed rules score each one out of 100, with a plain-English reason for every point lost.",
  },
  {
    Icon: Lock,
    title: "Lock the baseline",
    text: "On day one, upload the sprint as committed. It can't be edited, so every later change is measured against it.",
  },
  {
    Icon: Printer,
    title: "Report what changed",
    text: "Upload snapshots as the sprint runs. Scope added and removed, churn and completion land on one printable page.",
  },
];

const FAQ = [
  {
    q: "Does AI decide the score?",
    a: "No. The score comes from nine fixed rules, so the same story always gets the same number and every lost point has a reason you can read. AI rewrites are built but switched off on the live site.",
  },
  {
    q: "Do I need to connect Jira?",
    a: "No. Paste a story, or upload a CSV in the Sprintwise template or a Jira export with Issue key, Summary and Story Points. A live Jira connection is planned for version 2.",
  },
  {
    q: "What happens to my data?",
    a: "The demo runs in your browser and saves nothing. Signed in, your projects are stored so you can come back to them, and deleting your account deletes everything. The privacy page has the details.",
  },
  {
    q: "Can I change the rules?",
    a: "Each project can set its own maximum story size and vague-word list. Saving the settings re-scores every story in the project.",
  },
  {
    q: "Is it free and open source?",
    a: "Yes. Sprintwise is a portfolio project: free to use, with the full code, tests and every product decision on GitHub.",
  },
];

export default async function Home() {
  // Signed-in visitors see the home page too (the logo always leads here); their button opens the app.
  const signedIn = Boolean(await getSession());

  // Every preview below uses the same invented demo data and the same rules as the app.
  const scored = demoBacklog.map((story) => ({ story, r: scoreStory(story) })).sort((a, b) => a.r.score - b.r.score);
  const ready = scored.filter((s) => s.r.band === "Ready").length;
  const baseline = demoSprint.snapshots[0].stories;
  const latest = demoSprint.snapshots.at(-1)!.stories;
  const metrics = computeMetrics(baseline, latest);
  const finding = readinessFinding(compareReadiness(baseline, latest, DEFAULT_SETTINGS));
  const transcript = Object.values(videoLines).map((line) => line.caption);
  const latestRelease = RELEASES[0];

  const tabs: FeatureTab[] = [
    {
      id: "readiness",
      label: "Readiness",
      title: "Know which stories aren't ready, and why",
      body: "Every story gets a score out of 100 and a band. Keep the backlog in priority order, or list the weakest first so refinement time goes where it matters.",
      points: [
        "Nine fixed rules, from acceptance criteria to vague words",
        "A plain-English reason for every point lost",
        "Unestimated or oversized stories can't be Ready",
      ],
      preview: (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
            <span className="font-medium">Tidyhome backlog</span>
            <span className="text-muted">
              {ready} of {scored.length} ready
            </span>
          </div>
          <ul className="divide-y divide-border">
            {scored.slice(0, 5).map(({ story, r }) => (
              <li key={story.key} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/50">
                <ScoreRing score={r.score} band={r.band} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] text-subtle">{story.key}</p>
                  <p className="truncate text-sm font-medium">{story.title}</p>
                </div>
                <BandBadge band={r.band} />
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: "scope",
      label: "Scope tracking",
      title: "See how far the sprint drifted from the plan",
      body: "Lock the sprint as committed, then upload snapshots as it runs. Stories are matched by key, so a rename isn't counted as removed and added.",
      points: [
        "Scope added and removed, net change and churn",
        "Completion measured against the original commitment",
        "A dated change log of every edit",
      ],
      preview: (
        <div className="card space-y-5 p-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Net change", formatPercent(metrics.netChange, { signed: true })],
              ["Churn", formatPercent(metrics.churn)],
              ["Completion", formatPercent(metrics.completion)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-surface-2/40 p-3">
                <p className="text-xs text-subtle">{label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            {[
              ["Committed", metrics.baselineTotal],
              ["Latest", metrics.latestTotal],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-20 text-muted">{label}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${(Number(value) / Math.max(metrics.baselineTotal, metrics.latestTotal)) * 100}%` }}
                  />
                </span>
                <span className="w-14 text-right tabular-nums">{value} pts</span>
              </div>
            ))}
          </div>
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">{finding}</p>
        </div>
      ),
    },
    {
      id: "report",
      label: "Sprint report",
      title: "One page for the retrospective",
      body: "Everything the team needs to talk about, on one printable A4 page. No slides to build.",
      points: [
        "The readiness finding in one plain sentence",
        "Metrics, the biggest changes and the change log",
        "Print it or save it as a PDF",
      ],
      preview: (
        <div className="relative">
          <div className="absolute inset-x-6 -bottom-3 h-full rounded-xl border border-border bg-surface/60" aria-hidden="true" />
          <div className="card relative space-y-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Sprint report</p>
                <p className="mt-1 text-lg font-semibold">{demoSprint.name}</p>
              </div>
              <Printer aria-hidden="true" className="h-5 w-5 text-subtle" />
            </div>
            <p className="text-sm text-muted">
              Scope grew {formatPercent(metrics.netChange)}, churn was {formatPercent(metrics.churn)}, and{" "}
              {formatPercent(metrics.completion)} of the original commitment was done.
            </p>
            <div className="space-y-2" aria-hidden="true">
              {[92, 78, 85, 60].map((w, i) => (
                <div key={i} className="h-2 rounded-full bg-surface-2" style={{ width: `${w}%` }} />
              ))}
            </div>
            <Link href="/demo/report" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              Open the sample report
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="aurora-blob absolute -top-40 left-[10%] h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-3xl" />
          <div
            className="aurora-blob absolute -top-20 right-[5%] h-[24rem] w-[24rem] rounded-full bg-fuchsia-500/15 blur-3xl"
            style={{ animationDelay: "-6s" }}
          />
          <div
            className="aurora-blob absolute top-40 left-[45%] h-[20rem] w-[20rem] rounded-full bg-sky-400/15 blur-3xl"
            style={{ animationDelay: "-12s" }}
          />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pt-24 lg:pb-28">
          <div className="animate-fade-up">
            <Link
              href="/changelog"
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 py-1 pr-3 pl-1 text-xs font-medium text-muted backdrop-blur transition-colors hover:border-accent hover:text-foreground"
            >
              <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{latestRelease.version}</span>
              Version 1 is out: see what&apos;s new
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Were we ready, <span className="text-gradient">and did we stick to it?</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted text-pretty">
              Sprintwise scores user stories for readiness before planning, then measures how much the sprint changes
              after the team commits. No Jira setup: paste a story or upload a CSV.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/demo" className="btn-primary h-11 px-5 shadow-lg shadow-accent/25">
                Try the demo
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              {signedIn ? (
                <Link href="/projects" className="btn-secondary h-11 px-5">
                  Open your projects
                </Link>
              ) : (
                <SignInButton className="btn-secondary h-11 px-5" />
              )}
            </div>
            <p className="mt-3 text-sm text-subtle">The demo needs no account and saves nothing.</p>
          </div>

          <div className="animate-fade-up [animation-delay:150ms]">
            <HeroScorer />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Sprintwise in numbers" className="border-y border-border bg-surface/60">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4">
          {[
            { value: 9, label: "fixed rules", note: "the same story always gets the same score" },
            { value: 100, label: "point score", note: "with a reason for every point lost" },
            { value: 1, label: "printable page", note: "for the whole sprint retrospective" },
            { value: 0, label: "setup steps", note: "paste a story or upload a CSV" },
          ].map((stat, i) => (
            <Reveal key={stat.label} delay={i * 80} className="flex flex-col px-2 py-8 sm:px-4">
              <dt className="text-sm text-muted">
                <span className="sr-only">{stat.value} </span>
                {stat.label}
              </dt>
              <dd className="order-first text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl" aria-hidden="true">
                <CountUp value={stat.value} />
              </dd>
              <dd className="mt-1 text-xs text-subtle">{stat.note}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      {/* Video */}
      <section id="video" aria-labelledby="video-heading" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Watch</p>
          <h2 id="video-heading" className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            The whole product in two minutes
          </h2>
          <p className="mt-3 text-muted">A narrated walkthrough of the public demo, with captions so it also works muted.</p>
        </Reveal>
        <Reveal delay={100} className="mt-10">
          <DemoVideo transcript={transcript} />
        </Reveal>
      </section>

      {/* Features */}
      <section id="features" aria-labelledby="features-heading" className="relative scroll-mt-20 border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Product</p>
            <h2 id="features-heading" className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Two questions, answered with data
            </h2>
            <p className="mt-3 text-muted">Pick a part of the product. Every number is from the invented sample sprint.</p>
          </Reveal>
          <Reveal delay={100} className="mt-10">
            <FeatureTabs tabs={tabs} />
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 id="how-heading" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            From backlog to retrospective in three steps
          </h2>
        </Reveal>
        <ol className="relative mt-12 grid gap-6 md:grid-cols-3">
          <span
            aria-hidden="true"
            className="absolute top-6 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />
          {STEPS.map(({ Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 120} className="relative">
              <span className="relative grid h-12 w-12 place-items-center rounded-2xl border border-border bg-surface shadow-sm">
                <Icon aria-hidden="true" className="h-5 w-5 text-accent" />
                <span className="absolute -top-2 -right-2 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                  {i + 1}
                </span>
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{text}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Rules */}
      <section aria-labelledby="rules-heading" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <Reveal className="max-w-2xl">
              <p className="eyebrow">The rules</p>
              <h2 id="rules-heading" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Nine checks, 100 points, no black box
              </h2>
              <p className="mt-3 text-muted">
                80 or more is Ready, 50 to 79 needs work, below 50 isn&apos;t ready. Each project can tune the size limit and
                the vague words.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <Link href="/product#rules" className="btn-secondary shrink-0">
                How each rule is checked
              </Link>
            </Reveal>
          </div>
          <SpotlightGrid className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RULES.map((rule, i) => (
              <Reveal key={rule.id} delay={(i % 3) * 80}>
                <div className="spotlight card h-full p-5 transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-subtle">{rule.id}</span>
                    <span className="text-sm font-semibold tabular-nums">{rule.points} pts</span>
                  </div>
                  <p className="mt-3 font-medium">{rule.check}</p>
                  <span aria-hidden="true" className="mt-4 block h-1 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(rule.points / 20) * 100}%` }} />
                  </span>
                </div>
              </Reveal>
            ))}
          </SpotlightGrid>
        </div>
      </section>

      {/* CSV + FAQ */}
      <section aria-labelledby="faq-heading" className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:py-28">
        <Reveal>
          <p className="eyebrow">Questions</p>
          <h2 id="faq-heading" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Good to know
          </h2>
          <div className="card mt-8 flex items-start gap-4 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground">
              <FileSpreadsheet aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold">Works with what you already export</h3>
              <p className="mt-1 text-sm text-muted">
                The Sprintwise CSV template, or a Jira export with Issue key, Summary and Story Points.
              </p>
              <a href="/template.csv" className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
                Download the template
              </a>
            </div>
          </div>
        </Reveal>
        <Reveal delay={100} className="divide-y divide-border border-y border-border">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-subtle transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-muted">{a}</p>
            </details>
          ))}
        </Reveal>
      </section>

      {/* Closing call to action */}
      <section className="px-4 pb-20 sm:px-6 lg:pb-28">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-accent px-6 py-14 text-center text-accent-foreground sm:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="aurora-blob absolute -top-24 -left-10 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
            <div className="aurora-blob absolute -right-10 -bottom-24 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" style={{ animationDelay: "-9s" }} />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Check your next sprint before you commit to it</h2>
            <p className="mx-auto mt-3 max-w-xl text-accent-foreground/85">
              Open the demo with an invented backlog and sprint. No account, nothing saved.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/demo" className="btn h-11 bg-white px-5 text-zinc-900 hover:bg-white/90">
                Open the live demo
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <a href={GITHUB_URL} className="btn h-11 border border-white/30 px-5 text-accent-foreground hover:bg-white/10">
                <Code2 aria-hidden="true" className="h-4 w-4" />
                Read the code
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
