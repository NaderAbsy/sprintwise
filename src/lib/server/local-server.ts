import "server-only";

/** Whether BETTER_AUTH_URL names this machine (localhost, 127.0.0.1 or ::1): a development or test server, never a real site. */
export function isLocalServer(url: string | undefined = process.env.BETTER_AUTH_URL): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Switches that exist only for tests (email sign-in, the pretend Jira, canned AI replies). They skip real
 * protections, so they must never be on in a real deploy. Refused on Vercel, and anywhere else unless
 * BETTER_AUTH_URL says the server is local: a copy of this public repository run on another host (Docker, a VPS)
 * with one of them set would otherwise be wide open.
 */
export function testFlag(name: "ENABLE_TEST_SIGN_IN" | "JIRA_FAKE" | "AI_FAKE_RESPONSES"): boolean {
  if (process.env[name] !== "true") return false;
  if (process.env.VERCEL_ENV) throw new Error(`${name} must not be set on a Vercel deploy.`);
  if (!isLocalServer()) {
    throw new Error(`${name} is only for a local server. Set BETTER_AUTH_URL to http://localhost:<port>, or remove ${name}.`);
  }
  return true;
}
