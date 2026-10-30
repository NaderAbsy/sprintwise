import "server-only";
import { db } from "@/lib/server/db";
import { testFlag } from "@/lib/server/local-server";

/** GitHub account IDs (public numbers, not secrets) of the people who run Sprintwise. */
const OWNER_GITHUB_IDS = ["147534134"];

/** Test sign-in is never on in a Vercel deploy or on any non-local server (testFlag refuses), so this address can only be used locally. */
const TEST_OWNER = /^site-owner-[a-z0-9-]+@example\.test$/;

/** Whether this signed-in user runs the site, and so may see the usage insights. */
export async function isSiteOwner(user: { id: string; email: string }): Promise<boolean> {
  if (testFlag("ENABLE_TEST_SIGN_IN") && TEST_OWNER.test(user.email)) return true;
  const github = await db.account.findFirst({
    where: { userId: user.id, providerId: "github", accountId: { in: OWNER_GITHUB_IDS } },
    select: { id: true },
  });
  return Boolean(github);
}
