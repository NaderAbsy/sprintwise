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

if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
  migrate();
} else if (process.env.VERCEL_ENV) {
  console.log(`Skipping database migrations for the ${process.env.VERCEL_ENV} deploy.`);
}
run("next build");
