import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";
import { formatDay } from "@/lib/sprint/dates";
import { GITHUB_URL, RELEASES } from "@/lib/site";

export const metadata: Metadata = { title: "Changelog" };

export default function ChangelogPage() {
  return (
    <>
      <PageHero eyebrow="Changelog" title="What's new in Sprintwise">
        <p>
          Every release, newest first. Full notes are on{" "}
          <a href={`${GITHUB_URL}/releases`} className="font-medium text-accent hover:underline">
            GitHub releases
          </a>
          .
        </p>
      </PageHero>
      <ol className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {RELEASES.map((release, i) => (
          <Reveal as="li" key={release.version} className="relative grid gap-4 pb-14 last:pb-0 sm:grid-cols-[9rem_1fr]">
            <div className="sm:text-right">
              <p className="text-sm text-muted">
                <time dateTime={release.date}>{formatDay(new Date(`${release.date}T00:00:00Z`))}</time>
              </p>
            </div>
            <div className="relative border-l border-border pl-6 sm:pl-8">
              <span
                aria-hidden="true"
                className={`absolute top-1 -left-[7px] h-3.5 w-3.5 rounded-full border-2 border-background ${
                  i === 0 ? "bg-accent ring-4 ring-accent/20" : "bg-border"
                }`}
              />
              <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
                <span className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-sm text-accent-soft-foreground">
                  {release.version}
                </span>
                {release.title}
              </h2>
              <p className="mt-2 text-muted">{release.summary}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {release.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </ol>
    </>
  );
}
