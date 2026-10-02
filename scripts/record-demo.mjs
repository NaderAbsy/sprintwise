// Records the demo video (docs/demo-video-script.md) from the live site as WebM.
// Usage: pnpm record-demo [base URL]   (default: https://sprintwise-omega.vercel.app)
// Only the public demo is used, so every story and number on screen is invented sample data.
// Captions stand in for a voice-over; a drawn cursor shows where each click lands.
import { chromium } from "@playwright/test";
import { mkdirSync, renameSync, rmSync } from "node:fs";

const BASE = process.argv[2] ?? "https://sprintwise-omega.vercel.app";
const SIZE = { width: 1440, height: 900 };
const TMP = "test-results/demo-video";
const OUT = "docs/demo.webm";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: SIZE,
  colorScheme: "light",
  recordVideo: { dir: TMP, size: SIZE },
});
const page = await context.newPage();
const wait = (ms) => page.waitForTimeout(ms);

/** Caption bar and cursor, injected after every navigation. */
async function overlay() {
  await page.evaluate(() => {
    if (document.getElementById("demo-caption")) return;
    const caption = document.createElement("div");
    caption.id = "demo-caption";
    caption.style.cssText =
      "position:fixed;left:50%;bottom:36px;transform:translateX(-50%);max-width:980px;padding:14px 22px;border-radius:14px;background:rgba(17,17,24,.88);color:#fff;font:500 22px/1.4 system-ui,sans-serif;text-align:center;z-index:2147483647;transition:opacity .3s;opacity:0;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.25)";
    document.body.appendChild(caption);
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    cursor.style.cssText =
      "position:fixed;left:720px;top:450px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(79,70,229,.35);border:2px solid #4f46e5;z-index:2147483647;pointer-events:none;transition:left .7s ease,top .7s ease,transform .15s";
    document.body.appendChild(cursor);
  });
}

async function say(text, ms = 4000) {
  await overlay();
  await page.evaluate((t) => {
    const el = document.getElementById("demo-caption");
    el.textContent = t;
    el.style.opacity = "1";
  }, text);
  await wait(ms);
}

async function pointAt(locator) {
  await overlay();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(([x, y]) => {
    const c = document.getElementById("demo-cursor");
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
  }, [box.x + box.width / 2, box.y + box.height / 2]);
  await wait(800);
}

async function click(locator) {
  await pointAt(locator);
  await page.evaluate(() => (document.getElementById("demo-cursor").style.transform = "scale(.7)"));
  await wait(150);
  await locator.click();
  await wait(400);
  await overlay();
}

async function scrollTo(selector) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ behavior: "smooth", block: "start" }), selector);
  await wait(1200);
}

// 0:00 Landing
await page.goto(BASE);
await wait(800);
await say("Product Owners face two questions every sprint: were our stories ready, and did we stick to what we committed?", 5000);
await say("Sprintwise answers both with data. No Jira setup: paste a story or upload a CSV.", 4000);
await click(page.getByRole("link", { name: "Try the demo" }));

// 0:15 Backlog
await page.waitForURL(/\/demo/);
await say("Every story gets a score out of 100 from nine fixed rules. The weakest stories come first.", 4500);
await click(page.getByRole("button", { name: /TIDY-103/ }));
await say("This one uses vague words like 'fast' and 'easy', and states no benefit, so it scores 50.", 4500);
await say("No AI sets the score: the same story always scores the same, and every lost point has a reason.", 4500);

// 0:45 Score your own
await scrollTo("#try-it");
await say("You can score your own story. It runs in the browser; nothing is sent or saved.", 3500);
const title = page.getByLabel("Title");
await click(title);
await title.pressSequentially("Make invoice export fast", { delay: 45 });
await click(page.getByRole("button", { name: "Score this story" }));
await say("A vague one-line story scores low…", 3000);
const description = page.getByLabel("Description");
await click(description);
await description.pressSequentially(
  "As a finance admin I want to export an invoice as a PDF so that I can email it to a client",
  { delay: 18 },
);
const criteria = page.getByLabel(/Acceptance criteria/);
await click(criteria);
await criteria.pressSequentially("- The PDF downloads within 3 seconds\n- It matches the invoice on screen", { delay: 18 });
await click(page.getByLabel("Story points"));
await page.getByLabel("Story points").pressSequentially("3", { delay: 60 });
await click(page.getByRole("button", { name: "Score this story" }));
await say("…and the score climbs as the story gets clear. Only the word 'fast' still costs points.", 4500);

// 1:10 Sample sprint
await scrollTo("#sample-sprint");
await say("On day one the team locks a baseline it can't edit. Later CSV snapshots are compared against it, story by story.", 5000);
await pointAt(page.getByRole("region", { name: "Sprint metrics" }));
await say("Here scope grew 18.8%, churn was 50%, and only 37.5% of the original commitment was done.", 5000);
await pointAt(page.getByText(/40 points lower/));
await say("And the finding that matters: the stories that changed scored 40 points lower before planning.", 5500);

// 1:50 Report
await click(page.getByRole("link", { name: "Open the sprint report" }));
await page.waitForURL(/\/demo\/report/);
await say("It all fits on one printable page for the retrospective.", 4500);
await pointAt(page.getByRole("button", { name: "Print or save as PDF" }));
await wait(1200);

// 2:20 Close
await page.goto(BASE);
await say("I owned the requirements, backlog and testing end to end. Every rule and metric has an automated test.", 5000);
await say("Sprintwise: sprintwise-omega.vercel.app · code on github.com/NaderAbsy/sprintwise", 5000);

const video = page.video();
await context.close();
await browser.close();
mkdirSync("docs", { recursive: true });
renameSync(await video.path(), OUT);
rmSync(TMP, { recursive: true, force: true });
console.log(`Saved ${OUT}`);
