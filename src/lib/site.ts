/** Facts the public pages share, kept in one place so they stay consistent. */
export const GITHUB_URL = "https://github.com/NaderAbsy/sprintwise";
/** A GitHub issue form for ideas and problems. Issues are public, so the form asks for no work data. */
export const FEEDBACK_URL = `${GITHUB_URL}/issues/new?template=feedback.yml`;

/** The public site's tabs, in the header and the footer. */
export const MARKETING_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/guide", label: "Guide" },
  { href: "/demo", label: "Demo" },
  { href: "/changelog", label: "Changelog" },
  { href: "/about", label: "About" },
];

export type Release = { version: string; date: string; title: string; summary: string; items: string[] };

/** Newest first. Each entry matches a git tag and its GitHub release. */
export const RELEASES: Release[] = [
  {
    version: "v1.9",
    date: "2026-10-06",
    title: "Quicker on the click",
    summary: "Pages answer the moment you click, the app runs next to its database, and CSV imports are easier to get right.",
    items: [
      "The app now runs in Frankfurt, next to its database, instead of across the Atlantic.",
      "Clicking a project tab lights it up at once and shows a placeholder while the page loads.",
      "Sign-in is checked from a signed cookie for five minutes at a time, saving a database trip on every click.",
      "Drag a CSV onto the file box, or remove a chosen file and pick another.",
      "When an import is missing columns, the error lists the columns the file does have; Jira's \"Work item key\", \"Custom field (…)\" headers and Excel's UTF-16 files now work.",
      "Accessibility: the phone top bar and the shared report's top bar are marked as page headers, and the demo's story buttons are bigger targets.",
    ],
  },
  {
    version: "v1.8",
    date: "2026-10-05",
    title: "Listening",
    summary: "Cookie-free visit counts, and a Send feedback link on every page.",
    items: [
      "Send feedback in the footer and the app sidebar opens a short GitHub form for ideas and problems.",
      "The live site counts page views with Vercel Web Analytics: no cookies, and ids, share tokens and search terms are removed first.",
      "The Privacy page says exactly what is counted.",
    ],
  },
  {
    version: "v1.7",
    date: "2026-10-05",
    title: "See the sprint move",
    summary: "A burn-up chart on the sprint page and report, and trends that start talking from the second sprint.",
    items: [
      "A burn-up chart: scope and work done on each snapshot day, against what was committed on day one.",
      "The chart is on the one-page report too; the report now lists the 10 most recent scope changes.",
      "Trends compare the latest sprint with the one before from the second sprint, and averages from the fourth.",
    ],
  },
  {
    version: "v1.6",
    date: "2026-10-05",
    title: "A backlog you can run",
    summary: "Put the backlog in priority order, find stories fast, change several at once, and move from one weak story to the next.",
    items: [
      "Priority order: drag a story by its handle, or use the arrow keys. The export and the sprint picker follow it.",
      "Search by key or title, and filter by status as well as band.",
      "Tick several stories to set their status or delete them together.",
      "“Next to fix” on a story jumps to the next weakest one that isn't Ready.",
    ],
  },
  {
    version: "v1.5",
    date: "2026-10-05",
    title: "Sprints that keep themselves up to date",
    summary: "Change a status or estimate in a click, and a sprint built from the backlog records it for you.",
    items: [
      "Change status and points straight from the backlog list and the sprint page.",
      "Sprints built from the backlog record each change by themselves: no Save snapshot step.",
      "One automatic snapshot per day; undoing an edit the same day removes it, and reasons you tagged are kept.",
      "Sprints kept with CSVs remind you when the last snapshot is 3 or more days old.",
    ],
  },
  {
    version: "v1.4",
    date: "2026-10-05",
    title: "A score that's harder to fool",
    summary: "Stories with the right shape but vague content no longer pass, and each thing to fix is listed once.",
    items: [
      "“As a user” no longer counts: name who the story is for.",
      "Bigger stories need more acceptance criteria: 2 from 5 points, 3 from 13.",
      "More vague words, such as works, properly, better and stuff, each with a plain alternative.",
      "One reason per missing thing: no criteria shows as one line, not two.",
      "Existing scores update on their own; custom vague-word lists are kept.",
    ],
  },
  {
    version: "v1.3",
    date: "2026-10-05",
    title: "More forgiving",
    summary: "Fewer ways to lose work by accident, and completion that uses your team's own words for done.",
    items: [
      "Undo a baseline locked by mistake, until the first later snapshot is saved.",
      "Leaving a story with unsaved changes asks first.",
      "Choose which statuses count as done, such as Released or Accepted, in project settings.",
      "Delete buttons moved to the foot of the story and sprint pages, away from Edit.",
      "Clearer first steps for new projects, and tidier wording throughout.",
    ],
  },
  {
    version: "v1.2",
    date: "2026-10-03",
    title: "Built for Product Owners",
    summary: "Plan with your team's real velocity, see why scope changed, watch trends, and share reports with stakeholders.",
    items: [
      "Trends: velocity, completion, churn and readiness across sprints, with plain-English insights.",
      "Planning helper: readiness per story, your usual velocity, and a warning before committing unready stories.",
      "Sprint goals, and a reason on every scope change; the report adds them up.",
      "Share a read-only report link with stakeholders, and turn it off any time.",
      "Your team's own readiness checks, writing help without AI, CSV export and copy as text.",
    ],
  },
  {
    version: "v1.1",
    date: "2026-10-03",
    title: "Easier without Jira, and safer",
    summary: "Edit stories with a live score, run a sprint straight from the backlog, and a guide for newcomers.",
    items: [
      "Edit any saved story; the score updates as you type.",
      "Lock a baseline and save snapshots by ticking stories in the backlog. No CSV needed.",
      "New projects get a Getting started checklist, 12 sample stories on request, and a pre-filled two-week sprint.",
      "A Guide page explains every step, number and term.",
      "Security: input limits, security headers, shared sign-in rate limiting and encrypted GitHub tokens.",
    ],
  },
  {
    version: "v1.0",
    date: "2026-10-03",
    title: "Sprintwise version 1",
    summary: "All 18 version 1 stories done: the readiness check, scope tracking and the sprint report, live and tested.",
    items: [
      "Nine fixed rules score every story out of 100, with a reason for every point lost.",
      "Unestimated or oversized stories can't be Ready, whatever their score.",
      "Lock a day-one baseline, upload later snapshots, and see added, removed, churn and completion.",
      "A one-page printable report, including whether the stories that changed scored lower before planning.",
      "GitHub sign-in, a privacy page and full account deletion.",
      "Light, dark and system themes; WCAG 2.1 AA contrast; fully usable by keyboard.",
    ],
  },
  {
    version: "v0.6",
    date: "2026-10-03",
    title: "Rule settings and demo video",
    summary: "Teams can tune the rules per project, and a narrated walkthrough shows the whole product in two minutes.",
    items: [
      "Max story points and the vague-word list per project; saving re-scores every story.",
      "A 2-minute demo video with a natural AI voice-over and captions.",
      "Keyboard pass: the closed mobile menu leaves the Tab order and the theme switch is one Tab stop.",
    ],
  },
  {
    version: "v0.5",
    date: "2026-10-02",
    title: "Redesign, sample sprint and report",
    summary: "A new interface with light and dark themes, and a demo that shows a whole sprint without signing in.",
    items: [
      "A sidebar and project tabs: Backlog, Sprints, Import, Settings.",
      "Light, Dark and System themes, with score rings coloured by band.",
      "The demo gained an invented sample sprint and its one-page report.",
      "GitHub sign-in works on the first click, even before the page's scripts load.",
    ],
  },
  {
    version: "v0.4",
    date: "2026-10-01",
    title: "Live on Vercel",
    summary: "The first public deploy, with scope tracking and the sprint report.",
    items: [
      "Sprints with a locked baseline and dated snapshots, matched by story key.",
      "Net change, churn and completion, with a dated change log.",
      "Production database migrations run only on production deploys.",
    ],
  },
  {
    version: "v0.1",
    date: "2026-10-01",
    title: "Foundations and the readiness check",
    summary: "The rules engine, the backlog and CSV import.",
    items: [
      "The nine readiness rules, each with unit tests.",
      "Paste a story or import a CSV, including a Jira export.",
      "A public demo with an invented backlog that needs no account.",
    ],
  },
];
