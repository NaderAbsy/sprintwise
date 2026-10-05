import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

export type Progress = { stories: number; sprintId: string | null; baselineLocked: boolean; snapshotSaved: boolean };

/**
 * A short checklist for a new project: what to do next, in order. It
 * disappears once a sprint has a baseline and a later snapshot.
 */
export function GettingStarted({ base, progress }: { base: string; progress: Progress }) {
  const sprint = progress.sprintId ? `${base}/sprints/${progress.sprintId}` : null;
  const steps: { title: string; text: string; done: boolean; href?: string; cta?: string }[] = [
    {
      title: "Add your stories",
      // The empty backlog right below has the buttons, so this step has no link of its own.
      text: "Use the buttons below: score one by pasting it, import a CSV, or load sample stories to try things out.",
      done: progress.stories > 0,
    },
    {
      title: "Create a sprint",
      text: "Give it a name and its start and end dates.",
      done: progress.sprintId !== null,
      href: `${base}/sprints/new`,
      cta: "New sprint",
    },
    {
      title: "Lock the baseline",
      text: "Tick the stories the team committed to on day one. They become the plan every change is measured against.",
      done: progress.baselineLocked,
      href: sprint ?? `${base}/sprints`,
      cta: "Open the sprint",
    },
    {
      title: "Save a snapshot, then read the report",
      text: "Later in the sprint, update statuses and points, save a snapshot, and open the one-page report.",
      done: progress.snapshotSaved,
      href: sprint ?? `${base}/sprints`,
      cta: "Open the sprint",
    },
  ];
  if (steps.every((s) => s.done)) return null;
  const next = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section aria-labelledby="getting-started-heading" className="card mb-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="getting-started-heading" className="font-semibold">
          Getting started
        </h2>
        <p className="text-sm text-muted">
          {doneCount} of {steps.length} done ·{" "}
          <Link href="/guide" className="text-accent underline underline-offset-2">
            Read the guide
          </Link>
        </p>
      </div>
      <div
        aria-hidden="true"
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-4 md:gap-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            aria-current={i === next ? "step" : undefined}
            className={`rounded-lg border px-3 py-2.5 text-sm md:py-3 ${i === next ? "border-accent bg-accent-soft/40" : "border-border"}`}
          >
            <p className="flex items-center gap-2 font-medium">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${
                  step.done ? "bg-ready-dot text-white" : i === next ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted"
                }`}
              >
                {step.done ? <Check aria-hidden="true" className="h-3 w-3" /> : i + 1}
              </span>
              {step.title}
              {step.done && <span className="sr-only">(done)</span>}
            </p>
            <p className={`mt-1.5 text-muted ${i === next ? "" : "hidden md:block"}`}>{step.text}</p>
            {i === next && step.href && (
              <Link href={step.href} className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:underline">
                {step.cta}
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
