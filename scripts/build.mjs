// Production build. Database migrations run only for Vercel production
// deploys, so a pull-request preview can never change the live database
// (see DECISIONS.md, 2026-10-02). Locally and in CI, `pnpm db:migrate` and
// `prisma migrate deploy` are run explicitly instead.
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "production") {
  run("prisma migrate deploy");
} else if (process.env.VERCEL_ENV) {
  console.log(`Skipping database migrations for the ${process.env.VERCEL_ENV} deploy.`);
}
run("next build");
