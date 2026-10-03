// Production build. On Vercel, database migrations run before the build:
// production deploys migrate the live database, and preview deploys migrate
// the separate Neon "preview" branch (Preview has its own DATABASE_URL since
// 2026-10-03; see DECISIONS.md). Other environments skip them. Locally and in
// CI, `pnpm db:migrate` and `prisma migrate deploy` are run explicitly instead.
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
  run("prisma migrate deploy");
} else if (process.env.VERCEL_ENV) {
  console.log(`Skipping database migrations for the ${process.env.VERCEL_ENV} deploy.`);
}
run("next build");
