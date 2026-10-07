import "server-only";
import { betterAuth } from "better-auth";
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
    accountLinking: { enabled: true, allowDifferentEmails: true },
  },
  // Every page checks the session. A signed copy in a cookie saves a database round trip on each
  // click; the cost is that a session ended elsewhere can keep working for up to five minutes.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  // Parallel test sign-ups would trip the limiter; it stays on everywhere else. Counts live in the
  // database, so every serverless instance shares them.
  rateLimit: { enabled: testSignIn ? false : undefined, storage: "database" },
  plugins: [nextCookies()],
});
