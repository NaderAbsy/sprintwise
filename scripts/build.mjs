// Production build. On Vercel, database migrations run before the build:
// production deploys migrate the live database, and preview deploys migrate
// the separate Neon "preview" branch (Preview has its own DATABASE_URL since
// 2026-10-03; see DECISIONS.md). Other environments skip them. Locally and in
// CI, `pnpm db:migrate` and `prisma migrate deploy` are run explicitly instead.
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

/** Blocks for `ms` milliseconds; the build is a plain script with nothing else to do meanwhile. */
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Neon suspends an idle database, and waking it can take longer than Prisma's
 * connect timeout, so the first attempt may fail with P1001 ("can't reach") or
 * P1002 ("timed out"). Those are retried with growing waits; any other error,
 * such as a failing migration, stops the build at once.
 */
function migrate(attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const output = execSync("prisma migrate deploy", { stdio: ["inherit", "pipe", "pipe"], encoding: "utf8" });
      process.stdout.write(output);
      return;
    } catch (error) {
      const text = `${error.stdout ?? ""}${error.stderr ?? ""}`;
      process.stdout.write(text);
      const asleep = /\bP100[12]\b/.test(text);
      if (!asleep || attempt >= attempts) throw error;
      const wait = attempt * 5;
      console.log(`The database isn't reachable yet (attempt ${attempt} of ${attempts}); it may be waking up. Retrying in ${wait}s.`);
      sleep(wait * 1000);
    }
  }
}

/**
 * A production deploy with a missing or weak setting would start but be unsafe or half-broken: without CRON_SECRET the
 * nightly jobs are refused, with a localhost BETTER_AUTH_URL sign-in redirects go to the wrong place. Stops the deploy
 * (the live site keeps running the previous one) and names the problem; never prints a value.
 */
function checkProductionEnvironment() {
  const env = process.env;
  const problems = [];
  for (const name of ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "CRON_SECRET"]) {
    if (!env[name]) problems.push(`${name} is not set`);
  }
  if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length < 32) problems.push("BETTER_AUTH_SECRET is shorter than 32 characters");
  if (env.CRON_SECRET && env.CRON_SECRET.length < 16) problems.push("CRON_SECRET is shorter than 16 characters");
  if (env.BETTER_AUTH_URL && !/^https:\/\/(?!localhost|127\.|\[::1\])/.test(env.BETTER_AUTH_URL)) problems.push("BETTER_AUTH_URL must be an https:// address that isn't localhost");
  for (const name of ["ENABLE_TEST_SIGN_IN", "JIRA_FAKE", "AI_FAKE_RESPONSES"]) {
    if (env[name]) problems.push(`${name} is a test-only setting and must not be set`);
  }
  if (problems.length > 0) {
    console.error(`\nThe production environment isn't safe to deploy:\n${problems.map((p) => `  - ${p}`).join("\n")}\nFix them in Vercel (Settings → Environment Variables → Production), then redeploy.\n`);
    process.exit(1);
  }
}

if (process.env.VERCEL_ENV === "production") checkProductionEnvironment();

if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
  migrate();
} else if (process.env.VERCEL_ENV) {
  console.log(`Skipping database migrations for the ${process.env.VERCEL_ENV} deploy.`);
}
run("next build");
