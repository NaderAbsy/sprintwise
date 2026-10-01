# Decisions

One entry per decision: date, decision, options considered, reason. Newest first.

## 2026-10-01 — Rules v2: unestimated or oversized stories can't be Ready

- **Decision:** A story that fails C6 (not estimated) or C7 (above the max points) has its band capped at Needs work. Its score is unchanged, and the screen says why it's capped. `RULES_VERSION` is now 2.
- **Why:** Under v1, C6 and C7 were worth only 20 points between them. So a story with no estimate scored exactly 80 (Ready), and a 13-point story with two "I want" parts scored 85 (Ready). A team can't commit to a story it hasn't sized, or to one that needs splitting.
- **Options:**
  - (a) Keep the v1 weights.
  - (b) Reweight C6 and C7, which shifts every other score.
  - (c) Cap the band and leave the score alone.
- **Reason for (c):** Every point lost still has exactly one reason, and the 100-point table in the requirements doc stays valid.

## 2026-10-01 — GitHub-only sign-in for v1

- **Decision:** Keep GitHub as the only sign-in provider in v1. Google goes on the v2 list.
- **Reason:**
  - Demo mode already covers visitors who won't sign up.
  - Adding a second provider is new scope, and v1 scope is frozen.
  - Better Auth makes adding Google later a configuration change, not a rewrite.

## 2026-10-01 — Baseline is uploaded and locked in one step

- **Decision:** The baseline CSV is previewed in the browser (story count and total points). It is then locked through a confirmation dialog in the same step, so there's no unlocked draft baseline.
- **Reason:** The preview does the job a draft would. Fewer states means nothing to forget to lock. To redo a wrong baseline, delete the sprint (S-6).

## 2026-10-01 — A snapshot's date may equal the previous one's

- **Decision:** A later snapshot's "as of" date must be within the sprint and not *before* the previous snapshot. The same day is allowed.
- **Reason:** A team may re-plan twice in one day. Snapshots on the same date are ordered by upload time.

## 2026-10-01 — Demo visitors can score their own story (rules only)

- **Decision:** The demo page includes a paste box that runs the rules in the browser. There is no AI call, no request, and nothing is saved.
- **Options:** (a) sample data only; (b) rules-only paste box; (c) paste box with AI.
- **Reason:** It answers the doc's open question cheaply. The rules are pure functions, so nothing leaves the browser, there is no cost and there is no data risk.

## 2026-10-01 — Test-only email sign-in for end-to-end tests

- **Decision:** Better Auth's email sign-in is enabled only when `ENABLE_TEST_SIGN_IN=true`. Playwright sets this flag for its own server.
- **Safeguard:** The app refuses to start if the flag is set and `VERCEL_ENV=production`.
- **Options:** (a) mock GitHub OAuth; (b) seed sessions directly in the database; (c) test-only email sign-in.
- **Reason:** It's the least code, and it exercises the real session and cookie path. Real users only ever see GitHub sign-in, so no passwords are stored.

## 2026-10-01 — One current readiness result per story

- **Decision:** `readiness_results` has one row per story, which is replaced when the story is re-imported or re-scored.
- **What's kept:** `rules_version` and `settings_used` stay on the row.
- **Options:** (a) keep every scoring run as history; (b) keep the current result only.
- **Reason:** v1 never shows score history. The story page always recalculates from the rules, so the stored row only drives sorting and the summary.

## 2026-10-01 — One baseline per sprint, enforced by the database

- **Decision:** A partial unique index on `snapshots(sprintId) WHERE isBaseline` enforces one baseline per sprint. It's added by hand in the init migration.
- **Reason:** Prisma can't express partial indexes in the schema. Enforcing it in the database means a bug in app code can't create two baselines.

## 2026-10-01 — Rule IDs are C1–C9

- **Decision:** Readiness rules are C1–C9 (C for check); backlog stories keep F-/R-/S-/L- IDs.
- **Reason:** "R6" (a rule) and "R-6" (a story) were easy to confuse.

## 2026-10-01 — Better Auth instead of Auth.js

- **Decision:** Sign-in uses Better Auth 1.7 with GitHub as the only provider. The tech-stack table in the requirements doc says Auth.js.
- **Options:** (a) Auth.js (`next-auth` v5); (b) Better Auth.
- **Reason:**
  - `next-auth` v5 is still in beta (5.0.0-beta.32), and its Prisma adapter supports Prisma only up to v6.
  - Better Auth is stable, supports Next.js 16 and Prisma 7, and Auth.js now points new projects to it.
  - The doc's reason, "no passwords to store", still holds.

## 2026-10-01 — Node 24 LTS, Prisma 7.10, Next.js 16.3

- **Decision:** Node 24 (pinned in `.nvmrc`), Prisma 7.10.0, Next.js 16.3.8, Vitest 5.
- **Reason:**
  - Node 20 reached end of life in April 2026, and Vitest 5 needs Node 22 or later.
  - npm's `latest` tag for Prisma points at an 8.0 release candidate, so the build uses 7.10.0, the newest stable release.

## 2026-10-01 — CSV template frozen

- **Decision:** The template columns are `key, title, description, acceptance_criteria, story_points, status`. Only `key` and `title` are required.
- **Header aliases:** Jira export headers are accepted: Issue key, Summary, Story Points, and Story point estimate.
- **Reason:** Week 1 gate: freeze the template and the rules before building on them. Changing the template means changing `src/lib/csv`, the downloadable template and the tests together.
