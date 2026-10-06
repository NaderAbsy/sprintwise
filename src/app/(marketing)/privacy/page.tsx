import type { Metadata } from "next";
import { aiConfigured } from "@/lib/server/ai";
import { FEEDBACK_URL, GITHUB_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8 px-4 py-12 text-sm leading-6 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-base text-muted">Sprintwise is a personal portfolio project. It stores only what it needs to work.</p>
      </header>

      <section>
        <h2 className="text-base font-semibold text-foreground">What is stored</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>From GitHub sign-in: your GitHub account id, name, email and avatar link. No password.</li>
          <li>The projects, stories, sprints and snapshots you create or upload, and their scores.</li>
          {aiConfigured && <li>A count of how many AI suggestions you asked for each day, to enforce the daily limit.</li>}
          <li>Anonymous usage counts (checks run, imports, reports) with no user id or story text.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">Visit counts</h2>
        <p className="mt-2">
          The live site counts page views with Vercel Web Analytics. It sets no cookies and stores nothing on your
          device. Vercel tells visits apart with a hash of the request that it discards after 24 hours, so a visit
          can&apos;t be tied to you or followed to other sites.
        </p>
        <p className="mt-2">
          Before anything is sent, Sprintwise removes project, story and sprint ids, share-link tokens, and everything
          after a &ldquo;?&rdquo; in the address, such as search terms. What&apos;s left is the kind of page, the site
          you came from, your country, and your device and browser type.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">AI suggestions</h2>
        {aiConfigured ? (
          <p className="mt-2">
            When you ask for an AI rewrite, that story&apos;s text is sent to the Claude API from Anthropic to generate
            the suggestion. Nothing is sent unless you click the button. Scores never use AI; they come from fixed
            rules. Don&apos;t paste confidential or customer data.
          </p>
        ) : (
          <p className="mt-2">
            AI suggestions are switched off on this site, so no story text is sent to any AI service. Scores never use
            AI; they come from fixed rules.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">The demo</h2>
        <p className="mt-2">The demo uses invented sample data. Stories you score there stay in your browser.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">Deleting your data</h2>
        <p className="mt-2">
          Deleting a project removes everything in it. Deleting your account on the Account page removes your account
          and all your data at once.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">Feedback</h2>
        <p className="mt-2">
          <a href={FEEDBACK_URL} className="text-accent underline underline-offset-2">
            Send feedback
          </a>{" "}
          opens a short form on GitHub. It&apos;s posted as a public issue under your GitHub account, so describe things
          in general terms and leave out story text or anything else from your work.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">Reporting a security problem</h2>
        <p className="mt-2">
          Please report it privately through{" "}
          <a href={`${GITHUB_URL}/security/advisories/new`} className="text-accent underline underline-offset-2">
            GitHub&apos;s vulnerability reporting
          </a>
          , not in a public issue. The{" "}
          <a href={`${GITHUB_URL}/blob/main/SECURITY.md`} className="text-accent underline underline-offset-2">
            security policy
          </a>{" "}
          says what&apos;s in scope and what to expect.
        </p>
      </section>
    </article>
  );
}
