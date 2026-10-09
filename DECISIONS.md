# Decisions

One entry per decision: date, decision, options considered, reason. Newest first.

## 2026-10-10 — v2.15: written for users, not reviewers

**The goal, from the user:** Sprintwise is mainly for other Product Owners and teams to use, not only a portfolio piece. Copy that called it a "portfolio project" (footer, FAQ, About, Privacy, Terms) told visitors not to rely on it.

**Changed:**
- **Wording:** "a free, independent tool" in Privacy and Terms, "Free to use" in the footer and FAQ, "an independent project" on About. No name in these lines, at the user's request; Terms says "Sprintwise's developer".
- **Video ending:** the recruiter-facing "I owned the requirements, backlog and testing…" over the GitHub repo is replaced by a call to action on the signed-out home page: try the demo, or sign in with GitHub. The browser's cookies are cleared first so the visitor's view is filmed.
- **Changelog** moved from the header to the footer (PR #68): first-time visitors need Product, Guide, Demo and About; the changelog is for returning users. The home page's "New: …" badge still links to it.

**Not now:**
- **Google sign-in.** Most POs the user knows have GitHub; revisit later.
- **Team editing.** One owner per project today. Needs planning; to be discussed.

## 2026-10-09 — v2.14: new headline and a re-recorded demo video

**Headline.** "AI writes the tickets. Sprintwise checks they're ready." read as if Sprintwise had an AI that writes tickets, and left out people who write their own. Options offered: "However your stories are written, Sprintwise checks they're ready", "Ready stories in. Scope changes measured.", and "Know your stories are ready before the sprint starts." The user chose the last. The paragraph under it still says "AI-drafted or not".

**Video.** The old one was from v0.6 (3 October) and said "No Jira setup", which stopped being true in v2.2. The user approved a new 17-line script covering Jira import, the AI-draft check, trends, the burn-up, refinement, sharing and the planning helper.
- **Filmed on a local production build**, not the live site: the signed-in scenes need a test user and the pretend Jira, and filming locally keeps every project, sprint and story invented. The script sets the data up off camera, films the public pages signed out, then adds the test session's cookies to the same browser.
- **The share dialog shows the live address.** The local link would read localhost; the script swaps the origin on screen, which is what the live site shows.
- **Length:** 2:57. The labels now say 3 minutes, and the video heading is "Sprintwise in three minutes".
- **Web copies:** MP4 5.3 MB (`-crf 30`) and WebM 4.8 MB (VP9 `-crf 48`; text stays sharp), both with `preload="metadata"`, so nothing downloads until play.

## 2026-10-09 — v2.13: terms, cookies, honest copy, data clean-up

**Asked for:** fix the database SSL warning; a security check; cookie policy and consent banner; remove unsupported claims; alt text, contrast and keyboard checks; terms of service.

**No cookie banner.** Sprintwise sets only the cookies sign-in needs (`better-auth.session_token`, `session_data`, `state`; `__Secure-` on the live site), keeps the theme choice in local storage, and Vercel Analytics is cookieless. Strictly necessary storage and a preference the visitor chose don't need consent, so a banner would add friction and imply tracking that doesn't exist. Instead the Privacy page lists each cookie, and an end-to-end test fails if sign-in sets a cookie the page doesn't name.

**Terms of use page.** Plain English: free and as is, only add work you're allowed to, don't attack the site, content stays yours, Jira changes only on Send, may change or shut down, liability limited as far as the law allows. Not legal advice; written to set honest expectations for a portfolio project.

**Copy audit (a read-only pass over every public page, README and changelog):** no invented stats, testimonials or "secure/GDPR" claims. Fixed:
- "scores compare across teams" contradicted per-project settings;
- "the same story always gets the same score" is true within a project, so it now says so;
- "which writing tools don't do", "The whole product in two minutes" (the video predates Jira and refinement), "Teams rarely answer either with data", "fully usable by keyboard" softened to what tests show;
- changelog lines: the CSP also allows GitHub avatars; "No more CSV files" → "No CSV needed"; "The first step towards teams" → no teammates feature is planned;
- Privacy page omissions: encrypted GitHub tokens, IP-keyed sign-in attempt counts, the `read:me` scope; the demo saves nothing at all;
- README status and Jira limits were stale.
Left alone: the 2-minute video's narration (baked into the audio, and true in its one-project demo) and "0 tickets sent to an AI" (true while AI is off; revisit if it's ever switched on).

**Data clean-up.** Better Auth's `rate_limits` rows are keyed by IP address and were never deleted, for visitors with or without an account. The daily cron now also deletes attempt counts older than a day, ended sessions (IP and browser type) and expired verifications. Same route, so no new `vercel.json` entry or secret.

**SSL warning.** pg 8 treats `sslmode=require` as `verify-full` but warns that pg 9 will weaken it to libpq's "encrypt, don't verify". `withVerifiedSsl` rewrites require/prefer/verify-ca to `verify-full` before connecting, so behaviour is unchanged today and stays strict after the upgrade. Neon's certificates are publicly trusted.

**Checked, nothing to change:**
- **Accessibility:** a temporary sweep ran axe (WCAG 2.2 AA plus best-practice, every impact level) on 20 public and signed-in pages in light and dark themes: 0 findings. 489 Tab stops, every one with a visible focus ring. Images: no `image-alt` findings.
- **Security:** `pnpm audit --prod` clean; open alerts are the dev-only braces and sprintf-js (no patch exists); no CodeQL or secret-scanning alerts; live headers (CSP, HSTS preload, frame DENY, nosniff) in place; protected routes redirect; token endpoints 404; email sign-up disabled; foreign callback URLs refused.

## 2026-10-09 — v2.12: forms keep what was typed

**Found while testing v2.11 on the live site:**
- **Snapshot tick boxes:** after saving a sprint snapshot, the newly ticked stories showed unticked while the form's state still counted them.
- **Story errors:** a story that failed to save (a duplicate key, say) had everything typed cleared.

**Cause:** React 19 resets a form after its `action` runs. That resets uncontrolled fields to their initial values, and the DOM of controlled checkboxes without telling React.

**Fix:**
- **`keepValuesOnSubmit(action)`:** an `onSubmit` that sends the same `FormData`, including the submitter, to the useActionState action in a transition. That skips the reset.
- **Every action form now uses it.** The `action` stays, so the forms still work before JavaScript loads.
- **Regression tests:** the snapshot ticks, and the story kept after a duplicate-key error. Both failed before the fix.

**Also:**
- **"Why scope changed":** the reason legend gives the number of changes as well as points.
- **Planning helper:** "about 2 points a sprint of unplanned work (2 from bugs)".
- **Chart:** the burn-up's Today label stays inside the chart at the right edge.

## 2026-10-09 — v2.11: unplanned work, without buffers or new scales

**The question:** should Sprintwise add a QA buffer, a bug buffer, or T-shirt sizes?

**Decided against all three:**
- **QA buffer.** Testing is part of each story's estimate, because a story isn't done until it's tested. A separate QA number counts testing twice, or invites "done but untested" stories. Teams with an "In QA" stage are already handled: it isn't a done status unless the project says so.
- **Bug buffer.** Sprintwise's velocity is points of the original commitment that got done, and added work doesn't count. When bugs take time, less planned work gets done and velocity is already lower. Taking a buffer off velocity would count the same thing twice. Bug data is also weak:
  - many bugs live only in Jira;
  - they usually have no points;
  - reasons are tagged by hand;
  - three sprints is a small sample.
- **T-shirt sizes.** They size roadmaps and epics, not sprints, and that's outside Sprintwise's job. A second scale brings mapping debates and has no standard Jira field. A story with only a T-shirt size still isn't ready to plan.

**Built instead, to make the existing numbers honest and explained:**
- **`defaultReasons`:** added work of a bug-like issue type (Bug, Defect, Incident, Hotfix) gets the reason "bug" when nobody chose one. This applies in automatic tracking and CSV snapshots.
- **`addedUnestimated`:** the Scope added tile and the report say "plus N with no estimate".
- **`averageVelocity` returns `unplanned` and `unplannedBugs`:** the average points added mid-sprint, and how many were bugs. The planning helper explains that velocity already allows for them; nothing is subtracted.
- **Copy:** "testing included" in the refinement hint and the Guide's Story points entry.

## 2026-10-08 — v2.10: speed and accessibility check, and a phone pass

**Lighthouse 12:**
- **Live public pages:** 8 pages, phone and desktop presets.
- **Signed-in screens:** 11 screens on a local production build, with the 12 sample stories, a sprint and a baseline.
- **Results:**
  - Accessibility, best practices and SEO: 100 on every page.
  - Speed: 100 on desktop, 91–98 on phone, except the home page on phone at 84.

**Home page on phone:**
- **Cause:**
  - The hero faded in from `opacity: 0`, so the browser didn't count it as the main content; it picked the header logo, with a long render delay.
  - The video poster was a 124 KB JPEG.
- **Fix:**
  - `animate-rise` (transform only) for the hero and page heroes.
  - The poster as WebP (63 KB).
- **Result:** measured locally, the score went from 84 to 94–95 and TBT from 160 to 45 ms. The main content is now the intro paragraph, painted about 0.2 s after the request; Lighthouse's slow-phone simulation estimates 3.0 s.

**Not changed:**
- **bf-cache:** pages are `no-store` because they read the session.
- **"Legacy JavaScript" and "unused JavaScript":** estimated at about 150 ms on a simulated slow phone, inside libraries.
- **The large DOM on the backlog:** one row per story.

**Phone pass of the signed-in screens:** screenshots of every screen at 390 px; nothing is wider than the screen. Two fixes:
- **Project tabs:** they lose their icons and some padding below `sm`, so all five fit.
- **Report metric cards:** two columns on phones, five on paper and wider screens.

**Small fixes:**
- **Empty filters:** they stay out of backlog search addresses. Empty fields are disabled for the moment `next/form` reads them, then switched back on.
- **Demo scorer:** scores as you type once there's a title.
- **README:** the "Known limits" section is up to date.
- **`record-demo`:** it cuts the blank start itself.

## 2026-10-08 — v2.9: fixes from a full click-through of the live site

Every public page at desktop and phone width, light and dark, and every signed-in flow in a "QA test" project with invented stories: add, edit, import, quick edits, filters, refinement, sprint, baseline, report, share link, trends, settings, export, account.

**Bugs, now with regression tests (`e2e/qa-fixes.spec.ts`):**
- **Wrong tab lit after an import:** `ProjectTabs` kept the last click and matched it again when the address came back to where the click started. The click is now forgotten once the address moves on.
- **False "Changed" on untouched criteria:** forms post `\r\n` line breaks, but text boxes hold `\n`. `readStoryForm` now normalises to `\n`, and the comparison normalises stories saved earlier.
- **A new story saved with no status** while its hint said To Do. It now starts as To Do.
- **Second-look and edited counts ignored the band filter,** so a click could show "No stories match". Both now count within the other filters.
- **Burn-up caption:** with a change on the baseline's own day, it said "stayed at 21" (the day's merged point). It now compares with the commitment, and gives done as a count rather than a second percentage beside Completion.
- **Trends counted a running sprint** (velocity "2 pts" on day one). A sprint now counts from its last day; until then the table marks it "in progress". The velocity e2e test's first sprint now ends yesterday.

**Content:**
- **Home badge:** names the latest release.
- **FAQ:** mentions team checks and the MIT license.
- **Product page:** gains "Refinement and Jira", second-look and backlog-tracking text, and WCAG 2.2.
- **Guide:** counts its own steps, and the Jira entry mentions connecting.
- **About:** says v2 shipped the Jira connection.
- **Trend insights:** say "averaged … over the last 3 sprints than before".

**Demo:**
- **Video:** the first 2.32 s were blank white (narration starts later), so both files are re-encoded from there. They're smaller too: MP4 4.2 → 2.4 MB.
- **Video label:** sits under the play button.
- **Phones:** tapping a story scrolls to its details.

**License:** MIT, chosen by the user, because the site called itself open source with no license.

**Not changed:**
- **The demo scorer's Score button:** the form mirrors the real one.
- **Empty filter params in the URL:** cosmetic only.

## 2026-10-08 — v2.8: hardening batch

Follow-ups from the v2.7 review that needed no one's accounts or secrets:
- **CodeQL** as a workflow (`codeql.yml`: JavaScript/TypeScript and the workflows, on pull requests, pushes to main and weekly), instead of switching on default setup in the repo settings.
- **The CI Postgres image** is pinned by digest.
- **`minimumReleaseAge: 1440`** in pnpm, plus a matching Dependabot cooldown: versions under a day old aren't installed or proposed.
- **`requireFreshUser`** reads the session from the database (no cookie cache) for deleting a project or the account, and for Jira send and sync. A session ended elsewhere stops these at once.
- **Account deletion:**
  - revokes the GitHub OAuth grant first (best effort; it never blocks the deletion);
  - then signs out, which clears the cookie cache. Before this, a new e2e test showed the browser still looked signed in for up to five minutes after deletion.
  - Atlassian has no revocation API for 3LO grants; the Privacy page says where to remove the app.
- **Privacy:** sessions keep the browser type and IP address they started from.

## 2026-10-08 — v2.7: security review and fixes

A full review: three parallel code audits (access control; injection and input; auth, secrets and supply chain) plus black-box tests of the live site. No cross-user data access was found: every action, route and page checks ownership through the DAL, and share links are 256-bit tokens. Fixed:

- **Atlassian sign-in into existing accounts (medium):** with account linking on and implicit linking allowed, an Atlassian account with a verified email matching a user's could sign in as them. Now `disableImplicitLinking`, and a `hooks.before` refuses `/sign-in/social` for Atlassian. Linking from Connect Jira still works (it only needs a session).
- **Catastrophic backtracking (high):** the "Acceptance criteria" heading regex had four optional whitespace runs; "AC" plus a few thousand spaces took minutes, reachable from Jira sync and the public share page. Replaced by tidy-and-compare (`isCriteriaHeading`, lines over 200 characters skipped). The Jira markup parser's repeats are bounded and its link pattern can't rescan.
- **CSV formulas (low):** cells whose first non-space character is `= + @`, or `-` not followed by a word, get an apostrophe; the importer strips it. Bullets like "- Full refunds" stay as typed, so `jira.csv` reads the same in Jira.
- **Server action ids (info):** `assertId`/`isId` in the DAL; an object like `{"not": ""}` can no longer reach a Prisma filter. Bulk id lists are filtered by `isId`.
- **Tokens reachable from the browser (info):** `/get-access-token`, `/refresh-token` and `/account-info` are in `disabledPaths`; the server uses `auth.api`, which they don't affect.
- **Sign-in without rate limiting (medium):** the GitHub sign-in server action called `auth.api` directly, skipping Better Auth's limiter. The button now calls the client, through the limited endpoint; the early-click script covers clicks before hydration.
- **Cron route open (low):** on Vercel it refuses every call unless `CRON_SECRET` is set and sent (constant-time compare).
- **Jira request paths (low):** site ids and issue keys are checked (`siteApi`, `isJiraKey`) before a URL is built.
- **AI cap (low):** refused attempts no longer count toward the site-wide total (conditional increment).
- **CSP:** `default-src 'self'` with `connect-src`, `img-src` (plus GitHub avatars), `media-src`, `frame-src 'none'`, `form-action 'self'` and `upgrade-insecure-requests`. `script-src` still allows inline scripts, because nonces would make every page dynamic. An e2e test fails on any CSP violation across the main pages.
- **For the user, outside the code:** set `CRON_SECRET` in Vercel; use a different `BETTER_AUTH_SECRET` for Preview than for Production (a preview build could otherwise mint production sessions while the cookie cache is on); rotate the Neon production password; turn on GitHub code scanning (CodeQL default setup); use two-factor sign-in on GitHub, Vercel, Neon and Atlassian.
- **Accepted:** the 5-minute session cookie cache (sign-out elsewhere takes up to 5 minutes to apply); account deletion doesn't revoke grants at GitHub or Atlassian (users can revoke them there).

## 2026-10-08 — v2.6: Atlassian personal data reporting

- **Why:** before the Jira connection can be shared with other companies, Atlassian requires apps that store account IDs to report them through the personal data reporting API, and to erase data for accounts Atlassian says were closed.
- **What Sprintwise stores from Atlassian:** the account ID and encrypted tokens in `accounts` (no name, email or profile; linking doesn't copy them).
- **Decision:** a daily Vercel Cron (`/api/cron/atlassian-accounts`, allowed on the Hobby plan) reports each ID when its cycle is up: 7 days, or Atlassian's `Cycle-Period` header. `atlassian_reports` keeps when each ID is next due. It sends batches of 90, using any connected account's token (Atlassian accepts any token issued to the app). On `closed`, the connection is deleted; `updated` needs nothing, as no profile data is kept. On 429 it stops, and the remaining IDs stay due for the next run.
- **Open endpoint:** the route is safe to call without a secret, because each ID is reported at most once per cycle, so extra calls do nothing. `CRON_SECRET`, if set, restricts it to Vercel Cron.
- **Not done:** a lighter backlog page. Measured at 300 stories: 927 KB raw but 53 KB compressed (about 180 bytes a story), and the page is interactive within 0.2 s on a 4× slowed CPU, so it isn't worth changing.

## 2026-10-07 — v2.5: status is picked from a list

- **Why:** the user found the table's status box confusing: it was a text box with suggestions (`<datalist>`), so the text could be edited, and the browser's arrow showed only suggestions matching the current text (nothing useful once a status was set).
- **Decision:** the quick status in the backlog and sprint tables is a `<select>` of `statusChoices`: To Do, In Progress, the statuses the project's stories use (Jira's own, say), then the done statuses, each once ignoring case; a story's own odd status is kept as an option. It saves on change. Typing a new status stays possible on the story's edit page and in the bulk Set status box, which keeps its suggestions.
- **Dropdown arrows:** one CSS chevron (`--chevron`, per theme) replaces the browser's, placed 0.625rem from the right edge with matching padding. Unlayered CSS, so it wins over padding utilities.

## 2026-10-07 — v2.4: clicks before the page is ready

- **Seen while testing Jira on the live site:** a click right after a page loads sometimes did nothing. Measured: the HTML arrives in about 0.2 s warm (1.6 s cold), and React makes buttons work 0.1–0.9 s after they appear (more on a slow connection, and after every deploy, when the scripts aren't cached yet). React only replays clicks once it has started; a click before that is dropped.
- **Decision:** a tiny inline script in `<head>` (`EARLY_CLICK_SCRIPT`) keeps the last button clicked before React starts, shows a busy cursor, and clicks it again once React owns that button (`__reactProps$` on it, `__reactContainer$` on the document). It removes itself on the first click after React starts, so nothing is clicked twice, and gives up after 10 s. Links already work without React.
- **Also:** Sync's "Syncing…" label was set inside the transition, so it only showed once the sync had finished; it's set before the transition now. Set status and Turn off the link show they're working.
- **Rejected:** disabling buttons until React is ready (they'd look broken), and keeping the database awake with a scheduled ping to avoid cold starts (Neon's free compute hours wouldn't cover it).

## 2026-10-07 — Jira tested end to end; two fixes from it

- **Tested on a real Jira Cloud site** (`sprintwise-test.atlassian.net`, invented tickets): connect, import by JQL, edit, Send to Jira (checked in Jira), change in Jira, Sync (checked in Sprintwise). It works.
- **Sync added issues that were left out at import.** Sync now adds only issues created in Jira after the last import or sync (`created` is read with each issue; importing from Jira sets `jiraSyncedAt`). Ones left unticked stay out, and the message says how many.
- **Criteria could be lost on sites with no criteria field.** Criteria typed into Sprintwise's own criteria box had nowhere to go in Jira. Send now writes them into the description's "Acceptance criteria" section (`withCriteriaInDescription` replaces an existing section or adds one), and says so.

## 2026-10-07 — v2.3: criteria in the description, Feature as a story (rules v5)

- **Found while setting up a real Jira test site:** Jira's current Scrum template creates team-managed projects whose work types are Epic, Feature, Task and Subtask (no Story), and which have no acceptance-criteria field. Teams write criteria in the description instead. Sprintwise scored every such story as having no criteria (−35) and treated Feature as "not a story".
- **Decision:** `criteriaOf(story)` uses the story's own criteria, or, when empty, the section under an "Acceptance criteria" heading in the description (`h3.`, `*bold*`, `**bold**`, `##`, or "Acceptance criteria:"; it ends at the next heading). Scoring, second-look hints, the story page, refinement and shared backlogs all use it, and the pages say when criteria came from the description. `Feature` joins `USER_STORY_TYPES`. `RULES_VERSION` 5, so stored scores refresh lazily. `splitCriteria` now also strips Jira's `#` and nested `**` bullets.
- **Not changed:** the stored text. Criteria stay in the description, so Send to Jira writes back exactly what the team wrote, where they wrote it.
- **Rejected:** moving description criteria into the criteria field on import (it would move text around in Jira on the next Send).

## 2026-10-07 — v2.2: connect Jira

- **Why:** CSV exports were the biggest source of friction: hidden columns, Numbers re-saves, row limits and copying edits back by hand. The user's own company may not allow third-party Jira apps yet, but other teams can use the connection, and it can be tested on a free Jira site with invented issues.
- **OAuth:** Better Auth's built-in Atlassian provider, used only to **link** an Atlassian account to a signed-in user (`disableSignUp`, so it can't create accounts). Scopes: `read:jira-work`, `write:jira-work`, plus the provider's defaults (`read:jira-user`, `offline_access` for refresh). Tokens are encrypted (`encryptOAuthTokens`) and refreshed and rotated by `getAccessToken`. `allowDifferentEmails` is on because work Atlassian addresses rarely match GitHub's; linking always needs a signed-in session.
- **API:** REST v2 (`/rest/api/2/search/jql` with `nextPageToken`, `/field`, `/issue/{key}`), because v2 returns text fields as wiki markup, which Sprintwise already renders and sends back unchanged; v3's document format would need converting both ways. Story points and acceptance criteria are found by field name per site. Up to 1,000 issues per search.
- **Reuse:** Jira issues become a CSV with Jira's column names (`issuesAsCsv`) and go through the same preview, checks, filters and ticks as a file. Sync uses the same reader and the shared `saveStories`.
- **Never lose work:** Sync skips stories edited here and not yet sent, and doesn't add new issues that are already finished. Send writes title, description, criteria and points. If an issue type's screen refuses points or criteria (common for bugs), it sends the rest and says so.
- **Off unless configured:** without `ATLASSIAN_CLIENT_ID` and `ATLASSIAN_CLIENT_SECRET`, no Jira UI appears. Tests use `JIRA_FAKE` (refused on Vercel, like the other test switches).
- **Rejected:** a Forge or Connect app (runs inside Jira and needs Marketplace listing; more than a portfolio needs); webhooks for live sync (needs admin setup on each Jira site); API tokens pasted by users (unsafe to store, and they carry the user's full permissions).

## 2026-10-07 — v2.1: refinement mode

- **Why:** estimates belong to the team, and readiness gets fixed in refinement, but Sprintwise had no screen for that meeting. Story points were also the most confusing idea for a first-time product owner.
- **Decision:** `/projects/[id]/refine` shows one story at a time, in priority order. By default it's the unfinished stories that aren't Ready (the story on screen stays in the list after it becomes Ready); "All unfinished" shows every one. Each has its text (Jira formatting), score, what to fix and second-look hints, plus a row of sizes (1, 2, 3, 5, 8, 13) that saves through `quickUpdateStory`. So an estimate re-scores the story, records sprint changes and marks it "Edited here" for Jira, exactly like an inline edit. The screen tells the team how to estimate (show at once, highest and lowest explain, agree) and to split above the project's maximum. Arrow keys move; 1, 2, 3, 5 and 8 record. Edit story returns to the same story and list (`return=refine|refine-all`). The end page summarises Ready and unestimated counts.
- **Rejected for now:** live planning poker with each person voting from their own device (needs teammate accounts, which come next); timers or facilitation scripts (more to learn than they're worth).

## 2026-10-07 — v2.0 starts: a read-only backlog link

- **Why:** refinement is a team meeting, but only the owner could see the scores. Full team accounts come later; a read-only link is the cheapest useful step.
- **Decision:** `projects.shareToken` (32 random bytes, base64url, unique), like sprint report links. `/share/backlog/[token]` shows the project's unfinished stories (finished ones are counted, not listed) in priority order or weakest first. Each opens to its findings, band cap, type note, second-look hints, description and criteria. Scores are computed live with the project's settings. No edit controls, `noindex`, `no-referrer`, and a 404 once the link is off.
- **One Share dialog:** `ShareLink` now serves both reports and backlogs, with the page passing bound server actions and saying exactly what the link shows.
- **Privacy:** a "Share links" section on the Privacy page. Analytics scrubbing now hides the token in `/share/backlog/<token>` too; before this, only `/share/<token>` was covered.
- **Rejected:** a shared link that also shows sprints (more exposure than refinement needs); per-viewer links (accounts are the right tool for that, and come with teammates).

## 2026-10-07 — Home page: positioned for AI-written tickets

- **Why:** most people now let AI write their tickets, so "helps you write better stories" competes with AI tools and loses. Checking is the job that's left, and tracking the sprint is something writing tools don't do.
- **Decision:** the headline becomes "AI writes the tickets. Sprintwise checks they're ready." A new section shows an invented AI draft beside Sprintwise's real verdict on it, computed at render time with `scoreStory` and `secondLook`, so the page can't drift from the product. "0 setup steps" becomes "0 tickets sent to an AI". The FAQ opens with "We write our tickets with AI. Why use this?". The site description, steps, readiness tab and closing call to action follow the same line.
- **Rejected:** keeping "Were we ready, and did we stick to it?" (true, but it doesn't say why to choose this over an AI tool); an "AI-powered" angle (the rules are deliberately not a model, and that's a selling point for company data).

## 2026-10-07 — v1.14: worth a second look (rules v4)

- **Why:** most teams now let AI draft tickets. A pasted draft can pass every rule and score 100 while still opening with "Certainly! Here's a user story", listing "All edge cases are handled" as a criterion, or promising "reduce tickets by 30%". Writing is cheap now; checking is the job, and that's Sprintwise's place next to AI writing tools.
- **Decision:** `secondLook()` (`src/lib/readiness/second-look.ts`) finds five kinds of sign: chat leftovers (including Markdown `**bold**` / `###` that Jira shows as symbols), unfilled placeholders, boilerplate criteria that belong in a Definition of Done, filler words not already in the vague-word list, and outcome claims with a precise percentage. They're shown as "Worth a second look" on the story page, live in the editor, and as a backlog marker and filter.
- **Not scored, with one exception:** these are heuristics, so they ask for a person's look instead of costing points. Chat leftovers and unfilled placeholders are never right in a ticket the team works from, so they cap the band at Needs work (rules v4; stored scores refresh lazily). None of the 12 sample stories trigger anything.
- **Rejected:** an AI detector (guessing authorship is unreliable and beside the point: a careful human-reviewed AI draft is fine); counting boilerplate criteria against C1 (changes every team's scores for a heuristic); checking facts or system names (needs context Sprintwise doesn't have).

## 2026-10-07 — v1.13: reads like Jira

- **Why:** Jira's CSV export writes descriptions in Jira wiki markup (`h3.`, `*bold*`, `{{code}}`, `{noformat}`), which showed as raw symbols. Long descriptions also made the edit page lopsided: the Before box grew while the new-version box scrolled.
- **Display only:** `parseJira` / `parseInline` (`src/lib/stories/jira-markup.ts`) build a small tree that `JiraText` renders as React elements, never as HTML, so imported text can't inject anything. Links are kept only for http(s) URLs and open with `noopener noreferrer nofollow`. Text without markup (`looksLikeJira` false) is shown exactly as typed. Stored text, scoring and Copy for Jira all use the original text.
- **Edit page:** Before shows the formatted text, with "Show as typed" to compare raw markup line by line; the description and criteria boxes grow with their text (`fitHeight` on mount and input).
- **Rejected:** a markdown or wiki-markup library (a dependency for a dozen patterns, and most render via HTML strings); converting markup on import (would change the text that goes back to Jira).
- **Also:** saved column choices keep only picked columns (`rememberedColumns`), so a field set to "Not in this file" for one export is matched by name in the next (PR #37).

## 2026-10-07 — v1.12: honest counts, fair scores, back to Jira

- **Finished stories:** stories whose status is one of the project's done statuses are left out of every readiness count (backlog, band cards, projects list) and hidden from the backlog until "Show N finished". Next to fix skips them. Reordering while they're hidden counts positions among the shown stories only (`moveStory(…, withFinished)`), so a drag lands where it was dropped.
- **Issue types:** `stories.issueType` and `snapshot_items.issueType` (blank = story), read from Jira's Issue Type / Work type column and editable. Types other than Story / User Story skip C2 (story format) and C4 (benefit): they pass, and `Readiness.typeNote` says why. Everything else still applies, so a bug without acceptance criteria or an estimate still scores low. Rejected: unticking non-stories on import (bugs belong in sprints too); a separate rule set per type (more to learn for little gain). `RULES_VERSION` is unchanged, since stories without a type score exactly as before.
- **Back to Jira:** `stories.editedAt` is set when a story's text, estimate or type changes in Sprintwise (not its status, which moves in Jira anyway), and for stories written here. It's cleared by "Mark as copied to Jira" or by re-importing the story. Edited stories show "Edited here", a copy panel on the story page, a backlog filter, and `/projects/[id]/jira.csv` with Jira's column names (Issue key, Summary, Issue Type, Description, Acceptance Criteria, Story Points). A re-import leaves edited stories unticked, with a note. Rejected: writing to Jira directly (needs a Jira connection, kept for v2).
- **Early file picks:** a file chosen before the page's scripts loaded never fired `onChange`; the picker now reads it on mount (found as a flaky e2e test).

## 2026-10-07 — v1.11: before and after

- **Why:** fixing an imported story meant overwriting its text with nothing left to compare against, and a first real import brought in finished stories and no story text, so every score was low with no warning.
- **Editing:** each long field shows the saved text ("Before", read-only) beside the field ("New version"), stacked on phones. Changed fields get a marker and a Restore button; the live score shows the saved score and the change. The saved text is part of each field's accessible description. The edit layout goes side by side from `xl`, so the two columns plus the score panel aren't cramped.
- **Imports:** stories in the project's done statuses start unticked, with a line saying how many and why. If no Description or Acceptance criteria column is matched, a warning explains that every story will score low.
- **Rejected:** a diff view that highlights changed words (harder to read for long text, and the before text stays fully visible anyway).

## 2026-10-07 — v1.10: import any Jira export

- **Why:** a real import hit three walls at once: 318 rows against a 200-row limit, column names Sprintwise didn't know, and a need to keep only one epic's stories, which meant filtering in Excel first.
- **Decisions:**
  - **Pick in the browser, send only the picks.** The file (up to 1,000 rows, 5 MB) is read and scored in the browser. The person filters by text, status, epic or label and ticks stories. Only the ticked stories are sent, as JSON, up to 500 per import. The server repeats every check (`readImportPayload`: shape, lengths, points, duplicate keys), since anything can be sent to a server action. The rest of the file never leaves the computer, which matters for backlogs that are company data.
  - **Column matching** when a required column isn't recognised, or on request: one drop-down per field. The choice is saved on the project (`projects.importColumns`). A remembered column that isn't in a later file falls back to matching by name.
  - **Row-level problems** (empty title, duplicate key, too long) flag that row and leave it unticked; they no longer reject the file. Sprint snapshots stay all-or-nothing (`parseStoriesCsv`), because a snapshot has to be the whole sprint.
  - **Epics:** `stories.epic` is read from Jira's Parent summary, Epic Name, Epic Link or Parent column (best first), shown under the title in the backlog, and filterable. Labels are read for filtering the preview but not stored.
- **Limits:** the server-action body limit went from 1.2 MB to 4 MB (Vercel's cap is 4.5 MB). 500 stories per import stays well inside it, and the project cap of 1,000 stories is unchanged.
- **Rejected:** a live Jira connection (it needs a Jira admin to approve a third-party app; kept for v2); storing labels (no use for them after import yet).

## 2026-10-06 — v1.9: faster clicks

- **Why:** the site felt slow when clicking. Measuring showed the app's functions ran in Vercel's default region, Washington D.C. (`iad1`), while the Neon database is in Frankfurt (`aws-eu-central-1`). Every query crossed the Atlantic, and a page makes several in a row (session, project, then the page's own data). Clicks also gave no feedback until the whole next page had arrived.
- **Decisions:**
  - **Functions run in Frankfurt** (`vercel.json` `"regions": ["fra1"]`), next to the database. Hobby allows one region, which is all that's needed.
  - **Session cookie cache, five minutes** (Better Auth `session.cookieCache`). Every page checks the session; a signed copy in a cookie skips that database read. Trade-off: a session ended elsewhere (signing out on another device) keeps working for up to five minutes. Signing out on the same device clears the cookie at once.
  - **Instant feedback:** a `loading.tsx` placeholder inside each project (and on Account), and the clicked project tab lights up straight away.
- **Kept the 404 for other people's projects:** a placeholder around the whole projects area made the server start a 200 response before checking who owns the project (the e2e ownership test caught it). The placeholder sits inside the project layout instead, after the ownership check. A missing sprint or story inside your own project still shows "not found", but with a 200 status while streaming.
- **Rejected:** moving the database to the US (a migration and new connection strings for no extra gain); making the public pages static (they check sign-in to show "Open app"; with the region fix they're quick enough).

## 2026-10-06 — Deploys wait for a sleeping database

- **What happened:** the v1.6 production deploy failed with Prisma P1001 ("can't reach database server") during `prisma migrate deploy`. Neon had suspended the idle database, and waking it took longer than Prisma's connect timeout. The next deploy, with the same migration, succeeded.
- **Decision:** `scripts/build.mjs` retries the migration step up to 4 times, waiting 5, 10 and then 15 seconds, but only for P1001 and P1002. Any other error, such as a migration that fails, stops the build straight away, as before.
- **Rejected:**
  - A longer `connect_timeout` in `DATABASE_URL`: the URL is a secret held only in Vercel, so it can't be changed from the code.
  - Turning off Neon's auto-suspend: it isn't adjustable on the free plan.

## 2026-10-05 — v1.8: visit counts and feedback

- **Why:** there was no way to tell whether anyone used Sprintwise, or to hear from people who did.
- **Visit counts: Vercel Web Analytics.**
  - It's free on Hobby (50,000 events a month, after which collection pauses with no charge), sets no cookies, and Vercel discards its visitor hash after 24 hours. No consent banner is needed, and no new service or account.
  - Rejected: Google Analytics, because of cookies and a consent banner; self-hosted Plausible or Umami, because they're another service to run.
  - Speed Insights is left for later.
- **Scrubbing (`redactUrl`, pure and tested):**
  - Project, story and sprint ids and share tokens become placeholders, such as `/projects/[project]/sprints/[sprint]/report`.
  - Every query string is dropped, so search terms and filters never leave the browser.
  - API calls aren't counted.
- **Only the live site:** the script renders when `VERCEL_ENV` is `production`. Previews, local runs and tests send nothing.
- **Feedback: a GitHub issue form,** linked as "Send feedback" from the public footer and the app sidebar.
  - App users already sign in with GitHub, so there's no new account and no inbox to run.
  - Issues are public, so the form says so, asks for no work data, and has a required checkbox confirming none is included.
  - Its config points security reports to private vulnerability reporting.
  - Rejected: an in-app form stored in the database, which would need moderation, spam protection and a way to reply.
- **To finish in Vercel:** Web Analytics has to be switched on once in the project's Analytics tab. Until then the script loads but nothing is recorded.

## 2026-10-05 — v1.7: see the sprint move

- **Why:** the sprint page showed totals only, so there was no way to see when scope moved or whether work was being finished. Trends said nothing until four sprints had run, so the first two months showed almost nothing.
- **Burn-up, not burn-down:** a burn-down hides scope changes inside a single line. Sprintwise is about scope change, so the burn-up shows scope and done as separate lines, plus the day-one commitment as a dashed line.
- **What "done" means here:** the points of every story in the sprint with a done status, including work added later. The two lines meet when everything is finished. This differs on purpose from Completion, which counts only the original commitment; the chart's caption says which is which.
- **Drawing:**
  - Step lines: a value holds until the next snapshot, because nothing in between is known. When a day has several snapshots, the last one counts.
  - While the sprint runs, the lines carry on to a "Today" marker.
  - The chart has a text summary for screen readers, which is also the caption.
- **On the report:** a shorter chart, and the scope-change list shows 10 rows instead of 15 so the page still prints on one A4 sheet. The sprint page keeps the full log.
- **Trends from sprint two:**
  - With two or three measured sprints, insights compare the latest with the one before, and say so: "a hint", not a trend.
  - From four sprints, insights compare averages, as before.
  - Differences under 5 points are still left out.

## 2026-10-05 — v1.6: a backlog you can run

- **Why:** ordering the backlog is a Product Owner's main job, but Sprintwise could only sort by score. There was also no search, no status filter, and no way to change more than one story at a time.
- **Priority order:**
  - A fractional `stories.rank`, so a move changes one row. When neighbours get within 1e-6, the backlog is renumbered.
  - Existing backlogs start in key order, comparing numbers as numbers (PROJ-2 before PROJ-10). New stories join the bottom, and imports add new keys in file order.
  - The CSV export follows priority, so importing it into a new project keeps the order.
  - Priority is the default view; weakest first is one select away. Reordering is only offered in priority order with no filters, because moving within a filtered list has no clear meaning.
- **Reordering:**
  - Drag by a handle, so text in the row's fields stays selectable.
  - Or focus the handle and use Up, Down, Home and End. Focus follows the story, and the new position is announced.
  - The table shows "Saving the new order…" then "Order saved.", and leaving mid-save asks first.
  - Not on phones: HTML drag-and-drop doesn't work with touch, so the handle is hidden there.
- **Search and filters:** a GET form, so the view lives in the URL and works without JavaScript. They cover key or title, status (including "no status") and band. Status options come from the statuses actually used.
- **Changing several at once:** tick boxes (including "all shown") to set a status or delete. A status set this way is recorded in sprints that follow the backlog, like any other edit.
- **Next to fix:** a link on the story page to the next story that isn't Ready, in "weakest first" order, wrapping around to the start.
- **Phones:** the table drops band, points and the handle, and the filter cards sit two by two.

## 2026-10-05 — v1.5: sprints that keep themselves up to date

- **Why:** the critique found keeping a sprint current was the most likely reason to stop after one sprint. Marking a story Done meant opening it, editing it, saving it, going to the sprint and saving a snapshot. Nothing reminded you, so a forgotten snapshot meant an empty report.
- **Quick edits:** status and points can be changed in place on the backlog list and on the sprint page. Each saves on Enter or when you leave the field, Escape puts it back, and points re-score the story. On phones only status is shown, so the table fits.
- **Automatic recording:**
  - A sprint "follows the backlog" (`sprints.tracksBacklog`) when its latest snapshot was picked from the backlog. A CSV snapshot turns it off, because the team has switched to exports.
  - Its stories are the latest snapshot's keys. Any story edit (quick edit, story page, CSV import) re-reads those stories from the backlog and records the difference in that day's automatic snapshot (`snapshots.auto`).
  - One automatic snapshot per day: later edits that day update it in place, compared again with the snapshot before it. If the edits are undone, it's deleted. Reasons already tagged are carried over by key and change type.
  - Snapshots saved by hand are never rewritten. Adding or removing stories still goes through "Add or remove stories", because membership is a decision, not an edit.
  - The planner is a pure function (`planTracking`). The write runs in a transaction that locks the sprint row, so two quick edits can't both create the day's snapshot.
- **Dates:** "today" is the UTC day. The snapshot is never dated before the latest one or after the sprint's end, and edits up to a day after the end still count, so users east or west of UTC aren't cut off.
- **At the 30-snapshot cap,** edits stop being recorded rather than overwrite history.
- **Existing sprints:** they start following the backlog the next time a snapshot is saved from it. They weren't switched on silently, because a sprint built from CSVs would suddenly start recording backlog edits.
- **Reminder:** a running sprint that doesn't follow the backlog shows a banner once its latest snapshot is 3 or more days old.
- **Rejected:** a full event log of every edit with timestamps. It would show who changed what and when, but it needs a new model and a new report. The daily snapshot fits the existing metrics, report and trends unchanged.

## 2026-10-05 — v1.4: rules v3, a score that's harder to fool

- **Why:** in the critique walkthrough, "As a user I want a dashboard so that I can see stuff" with the criterion "Then it works" scored 95 and was Ready. A score that can be met by shape alone stops being trusted, and trust is the product. A bare story also showed "7 checks failed" when only four things were missing.
- **Changes (RULES_VERSION 3):**
  - **C2 names the user.** "As a user", "users", "end user", "person", "people", "someone", "somebody", "anyone" and "everyone" fail. Qualified roles such as "logged-in user" pass; the list is fixed, not a setting.
  - **C1 scales with size.** 1 criterion up to 3 points, 2 from 5 points, 3 from 13. Unestimated stories need 1. A fixed count is crude, but it's explainable and it stops one line covering an 8-point story.
  - **19 more default vague words,** such as works, properly, correctly, as expected, better, improve, handle, stuff and things. Each gets a plain-English alternative. "Working" was left out, because "3 working days" is measurable.
  - **Covered rules:** C3 is covered by C1 when there are no criteria, C7 by C6 when there's no estimate, and C4 by C2 when there's no "so that". A covered rule still fails and still loses its points, but it's reported on the covering rule's line with the combined points. The score is unchanged for these cases; only the explanation is shorter. Findings always add up to 100 minus the score.
- **Kept:** nine rules, 100 points, the same weights, and the bands.
- **Existing data:**
  - Projects still on the exact old default word list get the new one, through a SQL migration. Edited lists are left alone.
  - Stored scores with an older rules version are re-scored the next time the projects list, the backlog or the CSV export is opened.
- **Demo:** the two weak samples (TIDY-103, TIDY-110) each gained a second, equally vague criterion. Otherwise the new size rule would have moved their scores and made the recorded demo video's numbers wrong. They still score 50.

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
