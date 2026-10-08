import "server-only";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

/**
 * Cancels Sprintwise's access to the user's GitHub account (their OAuth grant),
 * so deleting an account leaves nothing behind at GitHub either. Best effort:
 * if GitHub can't be reached the account is still deleted, and the user can
 * revoke the app from GitHub's settings (Applications → Authorized OAuth Apps).
 */
export async function revokeGitHubGrant(userId: string): Promise<boolean> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return false;
  const account = await db.account.findFirst({ where: { userId, providerId: "github" }, select: { id: true } });
  if (!account) return false;
  try {
    const { accessToken } = await auth.api.getAccessToken({ body: { accountId: account.id, userId } });
    if (!accessToken) return false;
    const response = await fetch(`https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return response.status === 204;
  } catch {
    return false;
  }
}
