import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth-buttons";
import { getSession } from "@/lib/server/dal";

export default async function Home() {
  if (await getSession()) redirect("/projects");

  return (
    <div className="mx-auto max-w-2xl py-12">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Were we ready, and did we stick to it?</h1>
      <p className="mt-5 text-lg text-muted">
        Sprintwise scores every user story for readiness before planning, then measures how much the sprint changes
        after the team commits. No Jira setup: paste a story or upload a CSV.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/demo" className="btn-primary">
          Try the demo
        </Link>
        <SignInButton className="btn-secondary" />
      </div>
      <p className="mt-3 text-sm text-muted">The demo needs no account and saves nothing.</p>

      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Readiness check</h2>
          <p className="mt-2 text-sm text-muted">
            Nine fixed rules give each story a score out of 100, with a plain-English reason for every point lost.
          </p>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Scope tracking</h2>
          <p className="mt-2 text-sm text-muted">
            Lock the day-one sprint as a baseline, upload later snapshots, and see scope added, removed and churn.
          </p>
        </section>
      </div>
    </div>
  );
}
