/** Facts the public pages share, kept in one place so they stay consistent. */
export const GITHUB_URL = "https://github.com/NaderAbsy/sprintwise";

/** The public site's tabs, in the header and the footer. */
export const MARKETING_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/demo", label: "Demo" },
  { href: "/changelog", label: "Changelog" },
  { href: "/about", label: "About" },
];

export type Release = { version: string; date: string; title: string; summary: string; items: string[] };

/** Newest first. Each entry matches a git tag and its GitHub release. */
export const RELEASES: Release[] = [
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
