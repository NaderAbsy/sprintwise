import type { Metadata } from "next";
import Link from "next/link";
import { aiConfigured } from "@/lib/server/ai";
import { FEEDBACK_URL, GITHUB_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8 px-4 py-12 text-sm leading-6 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-base text-muted">Sprintwise is a free, independent tool. It stores only what it needs to work.</p>
      </header>

      <section>
        <h2 className="text-base font-semibold text-foreground">What is stored</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            From GitHub sign-in: your GitHub account id, name, email and avatar link, and GitHub&apos;s sign-in tokens,
            stored encrypted and not used after sign-in. No password.
          </li>
          <li>
            Your sign-in sessions, each with the browser type and IP address it started from, so a session can be
            recognised. A session ends when you sign out, after a week unused, or when you delete your account.
          </li>
          <li>The projects, stories, sprints and snapshots you create or upload, and their scores.</li>
          <li>
            A count of sign-in attempts per IP address, signed in or not, to slow down repeated tries. Counts older than a
            day are deleted daily, as are ended sessions.
          </li>
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
        <h2 className="text-base font-semibold text-foreground">Cookies and browser storage</h2>
        <p className="mt-2">
          Sprintwise sets cookies only to sign you in, and none for tracking or advertising, so there&apos;s no cookie
          banner. Without them, signing in can&apos;t work.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <code>better-auth.session_token</code>: keeps you signed in. Set when you sign in; ends when you sign out or
            after a week unused.
          </li>
          <li>
            <code>better-auth.session_data</code>: a signed copy of your session that saves a database check on each
            click. Lasts five minutes.
          </li>
          <li>
            <code>better-auth.state</code>: checks that a GitHub sign-in or Jira connection came back to the browser that
            started it. Lasts five minutes.
          </li>
        </ul>
        <p className="mt-2">
          On the live site each name starts with <code>__Secure-</code>, and none can be read by page scripts. Your
          light or dark theme choice is kept in your browser&apos;s local storage and never sent anywhere. Visit counts
          use no cookies (see above).
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">Jira connection</h2>
        <p className="mt-2">
          Connecting Jira is optional. When you connect, Atlassian gives Sprintwise tokens to read issues
          (<code>read:jira-work</code>), to update them (<code>write:jira-work</code>), and to see which Atlassian account
          connected (<code>read:me</code>). The tokens are stored
          encrypted and refreshed automatically. Sprintwise reads only the issues your saved search returns, and writes
          only when you click Send to Jira: the title, description, acceptance criteria and story points of stories you
          edited here. The project keeps the Jira site and search you chose. Disconnect from your Account page, which
          deletes the tokens; you can also revoke access from your Atlassian account settings.
        </p>
        <p className="mt-2">
          From your Atlassian account, Sprintwise keeps only its account ID, to know which tokens are yours; not your
          name, email or profile. As Atlassian requires, Sprintwise reports the account IDs it keeps to Atlassian once a
          week, and if Atlassian says an account was closed, Sprintwise deletes its connection.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">Share links</h2>
        <p className="mt-2">
          Nothing is public unless you share it. A sprint report link shows that one report; a backlog link shows the
          project&apos;s unfinished stories (titles, descriptions, acceptance criteria, scores, statuses and points),
          never its sprints, settings or other projects. Anyone with a link can view it without an account. Each link
          carries a long random secret, stays out of search engines, and stops working the moment you turn it off.
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
        <p className="mt-2">
          The demo uses invented sample data. Stories you score there are scored in your browser and never sent or saved.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground">Deleting your data</h2>
        <p className="mt-2">
          Deleting a project removes everything in it. Deleting your account on the Account page removes your account
          and all your data at once, and cancels Sprintwise&apos;s access to your GitHub account. To be sure, you can
          also check GitHub&apos;s settings (Applications, then Authorized OAuth Apps) and, if you connected Jira, your
          Atlassian account&apos;s connected apps.
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

      <p className="text-muted">
        Using Sprintwise is also covered by the{" "}
        <Link href="/terms" className="text-accent underline underline-offset-2">
          terms of use
        </Link>
        .
      </p>
    </article>
  );
}
