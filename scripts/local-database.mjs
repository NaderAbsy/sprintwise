// Refuses to run tests against a database that isn't on this machine. The tests create accounts, projects and
// stories, and a DATABASE_URL pointing at the live Neon database (left in .env or the shell) would fill it with
// test data. Prints nothing from the URL.
export function assertLocalDatabase(url = process.env.DATABASE_URL) {
  if (!url) return;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL isn't a valid address, so the tests won't run.");
  }
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
    throw new Error("DATABASE_URL points at a database that isn't on this machine. The tests only run against the local one (pnpm db:up).");
  }
}
