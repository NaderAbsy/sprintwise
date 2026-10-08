"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { requireFreshUser } from "@/lib/server/dal";
import { revokeGitHubGrant } from "@/lib/server/github";

/**
 * Deletes the user; the schema cascades to sessions, accounts, projects and AI usage (story F-5).
 * Sprintwise's access to their GitHub account is cancelled first, while the token still exists.
 */
export async function deleteAccount() {
  const user = await requireFreshUser();
  await revokeGitHubGrant(user.id);
  // Signing out clears this browser's cookies, including the five-minute copy of the session,
  // so the browser doesn't look signed in to an account that no longer exists.
  await auth.api.signOut({ headers: await headers() });
  await db.user.delete({ where: { id: user.id } });
  redirect("/");
}
