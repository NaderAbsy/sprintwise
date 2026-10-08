import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/server/db";

const github =
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
    : undefined;

/**
 * Email sign-in exists only so end-to-end tests can sign in without GitHub.
 * It must never be on in any Vercel deploy: previews share the live database.
 */
const testSignIn = process.env.ENABLE_TEST_SIGN_IN === "true";
if (testSignIn && process.env.VERCEL_ENV) {
  throw new Error("ENABLE_TEST_SIGN_IN must not be set on a Vercel deploy.");
}

/**
 * Atlassian is for connecting Jira to an existing account, never for signing up:
 * read issues, write back edits, and refresh without asking again (offline_access,
 * added by the provider). read:me lets the provider read who connected
 * (api.atlassian.com/me) to link the account.
 */
const atlassian =
  process.env.ATLASSIAN_CLIENT_ID && process.env.ATLASSIAN_CLIENT_SECRET
    ? {
        clientId: process.env.ATLASSIAN_CLIENT_ID,
        clientSecret: process.env.ATLASSIAN_CLIENT_SECRET,
        scope: ["read:jira-work", "write:jira-work", "read:me"],
        prompt: "consent" as const,
        disableSignUp: true,
        // The provider marks every email unverified, and Better Auth won't link an unverified account.
        // Atlassian's own profile says whether the email is verified, so use that.
        // (Atlassian's /me returns email_verified; Better Auth's profile type leaves it out.)
        mapProfileToUser: (profile: object) => ({ emailVerified: (profile as { email_verified?: unknown }).email_verified === true }),
      }
    : undefined;

/** GitHub sign-in only in real use: no passwords stored. */
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  socialProviders: { ...(github && { github }), ...(atlassian && { atlassian }) },
  emailAndPassword: { enabled: testSignIn },
  // The app never uses the GitHub tokens after sign-in; encrypted, a database leak doesn't expose them.
  account: {
    encryptOAuthTokens: true,
    // Connecting Jira links an Atlassian account to the signed-in user. Its email often differs from
    // GitHub's (a work address); linking needs a signed-in session, so nobody can claim an account this way.
    // No implicit linking: without it, an Atlassian sign-in with a verified email matching a user's would
    // be linked to that user and signed in as them.
    accountLinking: { enabled: true, allowDifferentEmails: true, disableImplicitLinking: true },
  },
  // Every page checks the session. A signed copy in a cookie saves a database round trip on each
  // click; the cost is that a session ended elsewhere can keep working for up to five minutes.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  // Parallel test sign-ups would trip the limiter; it stays on everywhere else. Counts live in the
  // database, so every serverless instance shares them.
  rateLimit: { enabled: testSignIn ? false : undefined, storage: "database" },
  // The browser never needs a user's stored provider tokens; the server reads them through auth.api,
  // which these don't affect. Closed so a script injected into a page couldn't fetch them.
  disabledPaths: ["/get-access-token", "/refresh-token", "/account-info"],
  hooks: {
    // Atlassian only connects Jira to a signed-in GitHub user; it never signs anyone in.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/social" && (ctx.body as { provider?: unknown } | undefined)?.provider === "atlassian") {
        throw new APIError("FORBIDDEN", { message: "Sign in with GitHub, then connect Jira from a project." });
      }
    }),
  },
  plugins: [nextCookies()],
});
