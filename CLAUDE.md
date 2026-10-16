@AGENTS.md

# Sprintwise

- Node 24 via nvm (`nvm use`); pnpm; local Postgres via `pnpm db:up`.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` (Vitest), `pnpm test:e2e` (Playwright against a production build on port 3100).
- `src/lib/readiness`, `src/lib/csv` and `src/lib/sprint` are pure functions with unit tests; keep I/O out of them.
- Every page and server action starts with `requireUser`, `requireProject` or `requireSprint` (`src/lib/server/dal.ts`), which check sign-in and ownership, then scopes every query by that project or sprint id.
- Database code that locks rows or counts against a limit has tests against a real Postgres: `pnpm test:db` (`*.db.test.ts`).
- Record decisions in `DECISIONS.md` (date, decision, options, reason). Rule changes bump `RULES_VERSION`.
- Use invented sample data only; never real company or client data.
