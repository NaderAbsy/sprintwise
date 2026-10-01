@AGENTS.md

# Sprintwise

- Node 24 via nvm (`nvm use`); pnpm; local Postgres via `pnpm db:up`.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` (Vitest), `pnpm test:e2e` (Playwright against a production build on port 3100).
- `src/lib/readiness`, `src/lib/csv` and `src/lib/sprint` are pure functions with unit tests; keep I/O out of them.
- Every page and server action reads data through `src/lib/server/dal.ts`, which checks sign-in and ownership.
- Record decisions in `DECISIONS.md` (date, decision, options, reason). Rule changes bump `RULES_VERSION`.
- Use invented sample data only; never real company or client data.
