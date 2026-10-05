# Decisions

One entry per decision: date, decision, options considered, reason. Newest first.

## 2026-10-05 — v1.3: more forgiving

- **Why:** a walkthrough as a new Product Owner found places where one slip cost real work, and a critique ranked them first because they're small to fix. The owner agreed the order: forgiving and wording fixes first, then scoring rules, then faster sprint updates, then backlog ordering, then a sprint chart, then usage numbers.
- **Undo a baseline:** allowed only while it's the sprint's only snapshot. Nothing has been measured against it yet, so undoing it can't rewrite any number. After the first later snapshot it's fixed, as before. The delete is one statement that checks the condition, so a snapshot saved at the same moment can't slip in. Rejected: editing a locked baseline (it would make every metric meaningless), and a time window such as 24 hours (the snapshot rule is easier to explain).
- **Unsaved changes:** the story editor asks before leaving once anything has been typed. The browser's own prompt covers reload, close and other sites. A capture-phase click listener covers links inside the app, because Next's router has no "before leave" hook. Saving isn't a link click, so it never asks. The browser Back button isn't covered; that would need a history hack.
- **Done statuses:** a per-project list, default Done, Closed and Resolved, matched ignoring case. They replace the defaults rather than add to them, so a team can drop "Closed" if it means "won't do". They change completion, velocity and trends, but not readiness scores, so saving doesn't re-score. They're kept apart from the rule settings, which are stored with each score.
- **Delete placement:** Delete story and Delete sprint moved from beside Edit and Open report to a section at the foot of the page.
- **Wording:** stale CSV-only copy on the New sprint and Sprints pages, "1 pts", and the empty project and empty projects pages, which showed two "add" prompts each.

## 2026-10-03 — v1.2: features for a Product Owner's week

- **Decision:** the owner picked seven additions from a list built around what a PO does each sprint:
  - trends
  - a planning helper
  - scope-change reasons and a sprint goal
  - a share link
  - CSV export
  - writing helpers
  - team checks
- **Everything stays rule-based:** no AI, no new services, no running costs.
- **Trends:** velocity is the original commitment's points that are Done at the latest snapshot, averaged over the last three measured sprints. Sprints with only a baseline are listed but not counted. Insights need four or more sprints, and a difference of 5 points or more, so noise isn't presented as a finding.
- **Planning helper:** it warns but never blocks. A PO may have good reasons to commit an unready story; the warning makes it a choice rather than an accident.
- **Reasons:** they are tagged per stored change, after the snapshot is saved, because the cause usually isn't known when the CSV is exported. The report weighs each change by the points it moved.
- **Share links:**
  - The token is 32 random bytes, checked for shape before any query.
  - The shared page is excluded from search engines and sends no referrer.
  - Turning sharing off deletes the token, and sharing again creates a new one.
  - The page shows only that one report, with nothing else from the project.
- **Team checks:** pass/fail, capped at 10 per project, checked by plain case-insensitive "contains". They cap the band, not the score, so the score keeps exactly one reason per lost point.
- **Export:** columns follow the import template, so an export re-imports as is. Cells that a spreadsheet would run as formulas are neutralized. A "- " list bullet is left alone, so acceptance criteria survive the round trip.
- **Rejected for now:** teammates on a project, and a live Jira connection. Both are bigger and stay in v2.

## 2026-10-03 — Easier to use without Jira, and a security pass

- **Usability review:** I walked through the app as a new user with no Jira and found four problems.
  - A saved story couldn't be edited, though fixing weak stories is the point of the score. You had to delete it and paste it again.
  - Sprints needed a CSV for the baseline and every snapshot, even when the stories were already in the backlog.
  - A new project gave no sense of the order of steps.
  - Words like baseline, churn and story points weren't explained anywhere.
- **Changes:**
  - **Edit story:** the score updates as you type, using the project's own rule settings, and the "Score a story" page does the same. The key can't change, because sprints match stories by key.
  - **Sprints from the backlog:** "From the backlog" is now the default source for the baseline and for snapshots. A later snapshot starts with the sprint's current stories ticked. CSV upload is still one click away.
  - **New projects:**
    - a four-step "Getting started" checklist that disappears once a sprint has a snapshot
    - a button that loads the 12 invented sample stories
    - a new sprint pre-filled as two weeks from today
  - **A public Guide page:** the steps, what each number means, and a glossary for people new to Scrum or Jira. It's linked from the header, the sidebar and the sprint metrics.
- **Security audit:** read-only, across ownership checks, auth, input limits, injection, headers, secrets, dependencies and CI. It found no critical or high issues. Every page and action already checks ownership.
- **Fixed:**
  - **Server-side limits:**
    - story fields: title 300, description and criteria 5,000, status 50, key 50, points 1,000, in both the form and the CSV parser
    - 1,000 stories per project, 50 sprints per project, 30 snapshots per sprint
    - the server action body limit lowered from 2 MB to 1.2 MB
  - **Test-only flags:** test sign-in and fake AI replies now refuse to start on any Vercel deploy, not only production, because Preview shares the live database.
  - **Security headers:** a CSP limited to framing, base URL, plugins and form targets, plus `X-Frame-Options`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`. The `X-Powered-By` header is removed.
  - **Sign-in rate limiting** now stores its counts in the database (`rate_limits`), so every serverless instance shares them.
  - **GitHub OAuth tokens** are encrypted at rest. The app never uses them after sign-in.
  - **A site-wide daily AI ceiling** (`AI_SITE_DAILY_LIMIT`, default 200), on top of the per-user cap.
  - **Dependencies:** patched versions of the Prisma CLI's `deepmerge-ts` and `mysql2` are pinned through pnpm overrides, so `pnpm audit --prod` is clean.
  - **CI:** a read-only token, and actions pinned to commit SHAs.
- **Since done:** Preview has its own database, Dependabot alerts and security updates are on, and `main` requires CI to pass before a merge.
- **Not done:** a `script-src` CSP. Next's inline bootstrap scripts would need a per-request nonce, which makes every page dynamic. There's no user-supplied HTML on the site, so the risk it covers is small.

## 2026-10-03 — A real home page and public site

- **Decision:** the landing page became a home page, and the public site gained Product, Changelog and About tabs, with a menu on phones. The demo video is on the home page, served from the app itself.
- **What's on it:**
  - A live readiness check in the hero: the same rules as the app run in the browser on every keystroke.
  - The video with a poster, a play button and a transcript.
  - Feature tabs using the ARIA tabs pattern, with previews built from the sample data.
  - Counters, the nine rules, how it works, an FAQ and a closing call to action.
- **Ideas taken from:**
  - Linear and Vercel: the release pill above the headline, gradient type, and a soft grid.
  - Stripe: an interactive product demo in the hero instead of a static picture.
  - Raycast: cards that glow under the pointer.
- **Kept honest:**
  - No logos, testimonials or user counts: Sprintwise has none. Every number on the page is a fact about the product or comes from the invented sample sprint.
  - Motion stops under `prefers-reduced-motion`, and content that fades in on scroll is visible without JavaScript.
  - The video transcript is read from the same file as the recorder's captions, so the two can't drift apart.
- **Rejected:** an animation library such as Framer Motion. CSS and one IntersectionObserver do the job without extra JavaScript.

## 2026-10-03 — v1.0: shipped without a written case study

- **Decision:** v1 is done and tagged v1.0. The written case study, part of L-1's packaging and Gate 6, is dropped, and its draft is removed from the repo.
- **Why:** the owner's call. The README already carries the problem, the screenshots, the product decisions and a link to the demo video. With this file, the reasoning lives in one place instead of two.
- **What v1 shipped:** 17 of 18 v1 stories Done; F-5 is Done too, apart from the AI-consent notice, which only applies once AI is switched on (R-4 and R-5 are in v2).

## 2026-10-03 — Demo voice-over uses Kokoro, an open-source neural voice

- **Decision:** `pnpm record-demo --voice` narrates with Kokoro-82M, an Apache-2.0 open model, run locally through `kokoro-js`. The default voice is `af_heart`. Every line is generated before recording starts, and each scene lasts as long as its line.
- **Options:**
  - (a) macOS text-to-speech: tried first, rejected as too robotic.
  - (b) A cloud service such as ElevenLabs: needs an account, an API key and, beyond the free tier, payment.
  - (c) Kokoro: natural-sounding, free, offline after a one-time ~300 MB model download, and no keys.
- **Notes:** `kokoro-js` is a dev dependency only, so it never ships with the app. Numbers and web addresses get a separate spoken version, so the captions stay exact and the speech sounds natural.

## 2026-10-03 — Keyboard pass (L-2)

- **Method:** I went through every page with only Tab, Shift+Tab, Enter, Space, the arrow keys and Escape, logging where focus landed, whether it was on screen, and whether a focus ring showed.
- **Found and fixed:**
  - The closed phone menu sat off-screen, but its 11 links were still in the Tab order. It's now `inert` while closed on small screens.
  - Opening the menu now moves focus into it, and Escape closes it and returns focus to the menu button.
  - The theme switch was announced as a radio group but had three Tab stops. It now has one Tab stop, and the arrow keys change the option (roving tabindex), as the ARIA radio-group pattern expects.
- **Already fine:** a skip link first on every page, visible focus rings everywhere, and logical order. The native `<dialog>` confirmations move focus to Cancel, close on Escape and return focus to the trigger.
- **Kept honest:** `e2e/keyboard.spec.ts` repeats the pass on every CI run, so a regression fails the build.

## 2026-10-03 — Rule settings re-score the whole project at once

- **Decision:** R-6 lets each project set its max story points (a whole number from 1 to 100) and its vague-word list (up to 100 words). Saving re-scores every story in the project in the same database transaction as the settings change. "Reset to defaults" restores 8 points and the default list.
- **Why one transaction:** a backlog where some scores use the old settings and some use the new would quietly mislead. Each score also stores `settings_used`, so an old score stays explainable.
- **What it doesn't touch:** sprint snapshots are frozen copies. Their readiness comparison in the report is scored with the project's *current* settings at the time the report is viewed.

## 2026-10-02 — Interface redesign: app shell, project tabs, light and dark themes

- **Navigation:**
  - Signed-in pages use a sidebar that lists every project. On phones it becomes a drawer.
  - Each project keeps its name and four tabs in view: Backlog, Sprints, Import and Settings. Sprints and Settings became their own pages instead of sections at the bottom of the backlog.
  - Public pages (landing, demo, privacy) use a slim top bar.
- **Themes:** Light, Dark or System.
  - An inline script sets `data-theme` before first paint, so there's no flash.
  - The choice is stored in `localStorage` and is a per-browser convenience only.
  - Without JavaScript, the system setting applies through `prefers-color-scheme`.
  - Printing always uses the light palette.
- **Visual language:**
  - Neutral greys with one indigo accent.
  - Readiness shown as a score ring coloured by band.
  - Band badges with a coloured dot, so colour is never the only signal.
  - Empty states with a single next step.
- **Accessibility:** colour tokens were checked to WCAG 2.1 AA in both themes. The axe scans caught the first "subtle" grey at about 3.4:1, and it was darkened to pass.
- **Why:** the first interface worked but read as a prototype. Projects with sprints needed real navigation, and dark mode was a user request.

## 2026-10-02 — AI suggestions move to v2; the live site runs without them

- **Decision:** No `ANTHROPIC_API_KEY` is set on the live site. R-4 (AI rewrite) and R-5 (Given / When / Then scenarios) move from the v1 backlog to the v2 list. When no key is set, the story page doesn't show the AI panel at all, and the privacy page says no story text is sent to any AI service.
- **Options:**
  - (a) Pay for the Claude API: a few dollars a month at expected use.
  - (b) Keep a visible "AI isn't set up" message.
  - (c) Keep the tested code, switch it off, and hide it.
- **Reason for (c):** It's a portfolio project with no budget. A permanently disabled button looks unfinished, while the code and its tests still show the work. Turning it on later needs only the API key and a redeploy.

## 2026-10-02 — AI suggestions: Claude Opus 5.5 at low effort, with server-side fallback

- **Decision:** R-4 and R-5 call the Claude API from a server action using structured outputs (`betaZodOutputFormat`), so the reply must match the fixed JSON shape. The settings:
  - model `claude-opus-5-5`, overridable with `ANTHROPIC_MODEL`
  - `effort: "low"`
  - a 15-second timeout and one retry
  - `fallbacks: "default"`, so a safety-classifier decline is re-run on Anthropic's recommended fallback model
- **Changes to the requirements doc:** it suggested "the cheapest model that gives usable rewrites". The Claude API guidance is to default to the current top model and leave a cheaper choice to the owner, so the model is one environment variable.
  - At $4 / $20 per million tokens, a typical suggestion of about 1,500 tokens in and 800 out costs roughly two US cents.
  - At the cap of 20 a day, that's at most about $0.40 per user per day.
- **Safety:** the story is sent as escaped data inside `<story>` tags and the prompt says to treat it as data. The reply is parsed against a Zod schema, which drops unknown fields, and length limits are checked again on the server. A refusal, a cut-off or malformed reply, a timeout or a rate limit shows a plain message, and the rule results still stand. Logs record only the HTTP status, never story text.
- **Cap:** `ai_usage` counts *attempts* per user per UTC day, so failed calls can't be used to get around the limit (default 20, `AI_DAILY_LIMIT`).
- **Tests:** `AI_FAKE_RESPONSES=true` returns a deterministic reply for end-to-end tests and refuses to start in production. Unit tests drive the wrapper with a fake client covering success, refusal, malformed reply, rate limit and timeout.

## 2026-10-02 — Database migrations run only for production deploys

- **Decision:** Vercel's build command is `pnpm build`, which runs `scripts/build.mjs`. That script runs `prisma migrate deploy` only when `VERCEL_ENV=production`, and preview builds skip it.
- **Why:** `DATABASE_URL` is still shared by Production and Preview. Under the old build command, a pull request's preview build would have applied unmerged migrations to the live database.
- **Done 2026-10-03:** Preview has its own `DATABASE_URL` (the Neon `preview` branch), so preview builds now migrate that branch, and preview deploys never touch the live database.

## 2026-10-02 — Sign-in is a server action

- **Decision:** "Sign in with GitHub" is a form that posts to a server action. The action calls Better Auth's `signInSocial` and redirects to GitHub.
- **Why:** The client-only button ignored clicks made before the page's JavaScript loaded. On a cold start, the first click often did nothing. A form works from the first click, even without JavaScript.

## 2026-10-02 — The demo includes a sample sprint

- **Decision:** `/demo` shows an invented three-snapshot sprint (Sprint 12, Tidyhome) and links to its one-page report at `/demo/report`. Both reuse the real report component.
- **Why:** F-2 asks for a sample backlog *and* sprint. The sample data was chosen to show the product's main finding: the stories that changed mid-sprint averaged 55 at the baseline, against 95 for the rest. A unit test pins these numbers.

## 2026-10-01 — What the sprint report counts as a change

- **Decision:**
  - The report's change log lists only scope changes: added, removed, re-estimated, and criteria changed.
  - Status changes and renames are counted in a note but not listed. Status changes are normal progress, and a rename doesn't change the work.
  - The full log stays on the sprint page.
- **Readiness comparison:**
  - A baseline story "changed scope" if it was removed, re-estimated or had its criteria edited between the baseline and the latest snapshot.
  - Each story is scored as it stood in the baseline.
  - Stories added later are in neither group.
- **One page:** the report shows at most the 18 most recent scope changes and prints in smaller type. An end-to-end test prints it to PDF and checks that it has one page, including with 25 changes.
- **Options:** (a) list every change; (b) cap and summarise; (c) shrink type until it fits.
- **Reason:** S-5 requires one A4 page. A long list of status changes would push out the numbers a stakeholder actually reads.

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
