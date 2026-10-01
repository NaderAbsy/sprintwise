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
 * It must never be on in production.
 */
const testSignIn = process.env.ENABLE_TEST_SIGN_IN === "true";
if (testSignIn && process.env.VERCEL_ENV === "production") {
  throw new Error("ENABLE_TEST_SIGN_IN must not be set in production.");
}

/** GitHub sign-in only in real use: no passwords stored. */
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  socialProviders: github ? { github } : {},
  emailAndPassword: { enabled: testSignIn },
  // Parallel test sign-ups would trip the limiter; it stays on everywhere else.
  rateLimit: { enabled: testSignIn ? false : undefined },
  plugins: [nextCookies()],
});
