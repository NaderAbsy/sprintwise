import type { Metadata } from "next";
import Link from "next/link";
import { deleteAccount } from "@/app/account/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const projects = await db.project.count({ where: { userId: user.id } });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <dl className="card divide-y divide-border text-sm">
        <div className="flex justify-between gap-4 p-4">
          <dt className="text-muted">Name</dt>
          <dd>{user.name}</dd>
        </div>
        <div className="flex justify-between gap-4 p-4">
          <dt className="text-muted">Email (from GitHub)</dt>
          <dd>{user.email}</dd>
        </div>
        <div className="flex justify-between gap-4 p-4">
          <dt className="text-muted">Projects</dt>
          <dd>{projects}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted">
        See <Link href="/privacy" className="underline">what Sprintwise stores</Link>.
      </p>
      <ConfirmButton
        label="Delete my account"
        title="Delete your account?"
        body={`This deletes your account and all ${projects} of your projects, with their stories, sprints and snapshots. It can't be undone.`}
        confirmLabel="Delete everything"
        action={deleteAccount}
      />
    </div>
  );
}
