# Case study draft: Sprintwise

*This is a draft for naderabsy.com. It uses only facts from the requirements doc, `DECISIONS.md` and the repository. Items in [brackets] are for you to fill in. Don't publish usage numbers until `pnpm usage` against the live database shows real ones.*

## The problem

Teams often start sprints with vague stories, and scope changes during the sprint go unmeasured. Both lead to missed commitments, yet few teams track either with data. Without numbers, readiness gets judged by gut feel and scope changes get argued about.

## Who it's for

- **Product Owners:** the primary user, who needs to know which stories are ready before planning.
- **Scrum Masters:** want a stability number for the retrospective.
- **Engineering leads:** want fewer vague stories reaching the team.
- **Stakeholders:** want a one-page view of whether the sprint held.

These are working assumptions from common agile practice, not interview findings.

## What I built

A live web app, at <https://sprintwise-omega.vercel.app>, that:

1. Scores every story out of 100 with nine fixed rules and gives a plain-English reason for every point lost.
2. Locks the day-one sprint as a baseline that can't be edited, then compares later CSV snapshots against it by story key.
3. Reports scope added and removed, net change, churn and completion on one printable page. It also shows whether the stories that changed scored lower before planning.

The demo, with invented data, works without signing up.

## My role

I owned the work end to end as Product Owner:

- the requirements doc, with goals, users, scope by version, acceptance criteria and a definition of done
- the backlog: 18 v1 stories in four epics, prioritised with MoSCoW, plus 2 moved to v2
- user acceptance testing and the release plan

I built it with Next.js, PostgreSQL and automated tests, in [N] weeks alongside my job.

## Decisions I'd defend in an interview

- **CSV first, Jira later.** Jira's sign-in and API setup is where side projects stall. CSV proved both halves of the product with no integration risk.
- **Rules set the score; AI never does.** A score that changes from one day to the next can't be argued with or improved against.
- **Fixing my own rules.** Testing showed a story with no estimate still scored 80 and passed as Ready. I capped the band instead of changing the weights, so every point lost still has exactly one reason.
- **AI built, then switched off.** I built and tested AI rewrites and Given / When / Then scenarios. For a portfolio site with no budget, I moved the live feature to v2 rather than pay ongoing costs or show a half-working button.
- **The baseline can't be edited.** If it could, every scope metric would be meaningless.

## How I knew it worked

- **Automated tests:** every scoring rule and every sprint metric has a unit test. The requirements doc's worked example is a test fixture: +16.7% net change, 36.7% churn and 70.0% completion, exactly.
- **End-to-end tests:** they drive real sprints through the interface, print the report to PDF, and check that it fits on one page.
- **Accessibility:** scans run on every page in light and dark mode, and caught a contrast problem that I then fixed.
- [Usage once live: checks run, imports and reports, from `pnpm usage`.]

## What I'd do next (v2)

- Connect Jira for automatic daily snapshots and who-changed-what.
- Turn on AI rewrites once there's a budget.
- Show a trend across sprints linking readiness scores to later scope changes.

## Links

- Live app: <https://sprintwise-omega.vercel.app>
- Demo: <https://sprintwise-omega.vercel.app/demo>
- Code: <https://github.com/NaderAbsy/sprintwise>
- Demo video: <https://github.com/NaderAbsy/sprintwise/releases/download/v0.6/sprintwise-demo.webm>
