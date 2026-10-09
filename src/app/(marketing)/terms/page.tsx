import type { Metadata } from "next";
import Link from "next/link";
import { FEEDBACK_URL, GITHUB_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of use" };

const link = "text-accent underline underline-offset-2";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8 px-4 py-12 text-sm leading-6 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of use</h1>
        <p className="text-base text-muted">
          Sprintwise is a free personal portfolio project run by Nader Absy. These terms cover the site at
          sprintwise-omega.vercel.app. Last updated 9 October 2026.
        </p>
      </header>

      <section>
        <h2 className="text-base font-semibold text-foreground">Using Sprintwise</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>It&apos;s free. Signing in needs a GitHub account; the demo needs nothing.</li>
          <li>
            Only add work you&apos;re allowed to put in an outside tool. If your company&apos;s rules don&apos;t allow
            that, use the demo or invented examples.
          </li>
          <li>
            Don&apos;t try to get into other people&apos;s data, overload the site, or get around its limits. If you find
            a security problem, report it privately as the{" "}
            <Link href="/privacy" className={link}>
              privacy page
            </Link>{" "}
            explains.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">Your content</h2>
        <p className="mt-2">
          What you add stays yours. Sprintwise stores it only to show it back to you and to the people you share a link
          with, as the{" "}
          <Link href="/privacy" className={link}>
            privacy page
          </Link>{" "}
          describes. You can export a project as CSV, turn off a share link, or delete a project or your account at any
          time.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">Jira</h2>
        <p className="mt-2">
          Connecting Jira is optional and uses your own Atlassian permissions. Sprintwise changes Jira only when you
          click Send to Jira, and you&apos;re responsible for the changes you send. Atlassian&apos;s own terms still
          apply to your Jira site.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">No guarantees</h2>
        <p className="mt-2">
          Sprintwise is provided as is, without any warranty. It may have bugs, and it may change, pause or shut down,
          possibly without notice. Keep your own copy of anything that matters: Jira or your CSV files stay the place of
          record. Scores and metrics are aids to a team&apos;s judgement, not a verdict on anyone&apos;s work. As far as
          the law allows, Nader Absy isn&apos;t liable for any loss from using the site.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">The code</h2>
        <p className="mt-2">
          The source code is on{" "}
          <a href={GITHUB_URL} className={link}>
            GitHub
          </a>{" "}
          under the MIT license, which covers copying and reusing the code. These terms cover using this site.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">Changes and questions</h2>
        <p className="mt-2">
          If these terms change, the date above changes too, and a big change is noted in the changelog. Questions go
          through{" "}
          <a href={FEEDBACK_URL} className={link}>
            Send feedback
          </a>
          , which opens a public GitHub issue.
        </p>
      </section>
    </article>
  );
}
