"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";

/**
 * GitHub sign-in as a server action, so the button works from a plain form
 * submit, even before the page's JavaScript has loaded.
 */
export async function signInWithGitHub(_prev: { error: string } | null): Promise<{ error: string } | null> {
  let url: string | undefined;
  try {
    const result = await auth.api.signInSocial({
      body: { provider: "github", callbackURL: "/projects" },
      headers: await headers(),
    });
    url = result.url;
  } catch {
    // Falls through to the error below; the provider isn't configured or GitHub is unreachable.
  }
  if (!url) {
    return {
      error:
        process.env.NODE_ENV === "development"
          ? "GitHub sign-in isn't set up: add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env."
          : "GitHub sign-in isn't available right now.",
    };
  }
  redirect(url);
}
