# Demo video script (under 3 minutes)

`pnpm record-demo` records a captioned version of this script from the live site (`docs/demo.webm`, no voice-over). Record it yourself with a voice-over for a warmer version.

The video sells one idea: Sprintwise tells you whether stories are ready before planning, and how much the sprint changed after it. Record the live site at <https://sprintwise-omega.vercel.app>. Everything shown is invented sample data.

**Set-up:**

- Browser at 1440 × 900, zoom at 100%, light theme.
- Bookmarks bar hidden.
- Open two tabs: `/demo` and `/demo/report`.
- Record a quiet screen capture with a voice-over, then trim the pauses.

| Time | On screen | Say (roughly) |
| --- | --- | --- |
| 0:00–0:15 | Landing page. Hover the score card and the three metrics. | "Product Owners face two questions every sprint: were our stories ready, and did we stick to what we committed? Teams rarely answer either with data. Sprintwise does both." |
| 0:15–0:45 | `/demo`. The backlog sorted weakest first. Click TIDY-103 "Fast and easy checkout". | "Every story gets a score out of 100 from nine fixed rules. No AI sets the score, so the same story always gets the same number, and every point lost has a reason. This one uses vague words like 'fast' and 'easy' and has no benefit stated, so it scores 50." |
| 0:45–1:10 | Scroll to **Score your own**. Type a weak title, score it, then add a "so that" clause and score again. | "You can paste your own story. It runs in the browser, so nothing is sent or saved. Watch the score move as the story gets clearer." |
| 1:10–1:50 | **Sample sprint** section. Point to the finding banner, then the five metric tiles, then the change log. | "On day one the team locks a baseline it can't edit. Later CSV snapshots are compared against it by story key. A renamed story isn't counted as removed and added. Here scope grew 18.8%, churn was 50%, and only 37.5% of the original commitment was done." |
| 1:50–2:20 | The finding: "Stories that changed scored 40 points lower at the baseline". Open the sprint report. | "And the finding that matters: the stories that changed mid-sprint were the ones that scored low before planning. That's the case for fixing stories before you commit to them." |
| 2:20–2:40 | The report page. Click **Print or save as PDF** to show the one-page preview. | "It all fits on one printable page for the retrospective." |
| 2:40–2:55 | GitHub repo README: the Product decisions section and the passing CI badge or Actions tab. | "I owned the requirements, backlog and testing end to end. Every rule and metric has an automated test, and every decision is written down." |
| 2:55–3:00 | Landing page. | "Sprintwise. Links below." |

**Tips:**

- Keep the cursor slow, and pause half a second before each click.
- Don't show the sign-in flow; the demo covers everything without an account.
- For a dark-mode variant, switch the theme in the header before recording. Don't switch mid-video.
