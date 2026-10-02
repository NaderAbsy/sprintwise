import type { Metadata } from "next";
import Link from "next/link";
import { deleteAccount } from "@/app/account/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const projects = await db.project.count({ where: { userId: user.id } });

  return (
    <>
      <PageHeader title="Account" description="Signed in with GitHub. No password is stored." />
      <div className="max-w-2xl space-y-6">
        <section aria-labelledby="profile-heading" className="card">
          <h2 id="profile-heading" className="border-b border-border px-5 py-3 font-semibold">
            Profile
          </h2>
          <dl className="divide-y divide-border text-sm">
            {[
              ["Name", user.name],
              ["Email (from GitHub)", user.email],
              ["Projects", String(projects)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-5 py-3">
                <dt className="text-muted">{label}</dt>
                <dd className="truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="text-sm text-muted">
          See{" "}
          <Link href="/privacy" className="text-accent underline-offset-2 hover:underline">
            what Sprintwise stores
          </Link>
          .
        </p>

        <section aria-labelledby="danger-heading" className="card space-y-3 border-not-ready/30 p-5">
          <h2 id="danger-heading" className="font-semibold text-not-ready">
            Danger zone
          </h2>
          <p className="text-sm text-muted">
            Deleting your account removes it and all {projects} of your projects, with their stories, sprints and
            snapshots.
          </p>
          <ConfirmButton
            label="Delete my account"
            title="Delete your account?"
            body={`This deletes your account and all ${projects} of your projects, with their stories, sprints and snapshots. It can't be undone.`}
            confirmLabel="Delete everything"
            action={deleteAccount}
          />
        </section>
      </div>
    </>
  );
}
