# Security policy

Sprintwise is a personal portfolio project, maintained by one person. Reports are welcome and taken seriously.

## Reporting a vulnerability

Please report security problems privately through GitHub. Don't open a public issue.

1. Go to the repository's [Security tab](https://github.com/NaderAbsy/sprintwise/security).
2. Choose **Report a vulnerability**.
3. Describe the problem, the steps to reproduce it, and what an attacker could do with it.

Only the maintainer can see the report. You'll get a private thread for the follow-up and, if you like, credit in the advisory when it's published.

## What to expect

- An acknowledgement within 5 working days.
- An assessment and a plan within 10 working days of that.
- A fix as soon as practical. Critical issues come first, and you'll hear when the fix is live.

## Supported versions

Only the latest version is supported: the `main` branch and the live site at https://sprintwise-omega.vercel.app. Fixes aren't backported to older releases.

## In scope

- The live site and this repository's code.
- Particularly: one user reaching another user's projects, stories or sprints; sign-in or session problems; guessing or abusing share links; injection; spreadsheet formulas in CSV export; and secrets exposed in the code or the site.

## Out of scope

- Denial of service, load testing, or high-volume automated scanning.
- Social engineering, phishing, or physical attacks.
- Problems in services Sprintwise runs on (GitHub, Vercel, Neon). Report those to the provider.
- Findings with no demonstrated impact, such as a missing header that's best practice only, version banners, or self-XSS.
- The demo and its invented sample data.

## Testing safely

- Use your own GitHub account and your own test data. Never access, change or delete other people's data. If you reach someone else's data by accident, stop and include that in your report.
- Keep request rates low.
- Give a reasonable time to fix the problem before sharing it publicly.

Research done in good faith within these rules is welcome, and won't lead to any complaint or legal action from the maintainer.
