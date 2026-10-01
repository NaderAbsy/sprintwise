import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl space-y-6 text-sm leading-6">
      <h1 className="text-2xl font-semibold">Privacy</h1>
      <p>Sprintwise is a personal portfolio project. It stores only what it needs to work.</p>

      <section>
        <h2 className="text-base font-semibold">What is stored</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>From GitHub sign-in: your GitHub account id, name, email and avatar link. No password.</li>
          <li>The projects, stories, sprints and snapshots you create or upload, and their scores.</li>
          <li>A count of how many AI suggestions you asked for each day, to enforce the daily limit.</li>
          <li>Anonymous usage counts (checks run, imports, reports) with no user id or story text.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold">AI suggestions</h2>
        <p className="mt-2">
          When you ask for an AI rewrite, that story&apos;s text is sent to the Claude API from Anthropic to generate the
          suggestion. Nothing is sent unless you click the button. Scores never use AI; they come from fixed rules.
          Don&apos;t paste confidential or customer data.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">The demo</h2>
        <p className="mt-2">The demo uses invented sample data. Stories you score there stay in your browser.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Deleting your data</h2>
        <p className="mt-2">
          Deleting a project removes everything in it. Deleting your account on the Account page removes your account
          and all your data at once.
        </p>
      </section>
    </article>
  );
}
