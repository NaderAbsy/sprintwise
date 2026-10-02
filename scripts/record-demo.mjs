// Records the demo video (docs/demo-video-script.md) from the live site.
//
//   pnpm record-demo [base URL]            captions only, WebM (needs nothing else)
//   pnpm record-demo --voice [base URL]    adds a text-to-speech voice-over, MP4 + WebM
//                                          (needs macOS `say` and a full ffmpeg: brew install ffmpeg)
//
// Only the public demo is used, so every story and number on screen is invented sample data.
// Each scene lasts as long as its narration, and every caption repeats what's said, so the
// video also works muted. Pick another voice with DEMO_VOICE="Daniel" (any `say -v '?'` voice).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync } from "node:fs";

const args = process.argv.slice(2);
const VOICE = args.includes("--voice");
const BASE = args.find((a) => !a.startsWith("--")) ?? "https://sprintwise-omega.vercel.app";
const VOICE_NAME = process.env.DEMO_VOICE ?? "Samantha";
const SIZE = { width: 1440, height: 900 };
const TMP = "test-results/demo-video";
const OUT = "docs/demo";

rmSync(TMP, { recursive: true, force: true });
mkdirSync(`${TMP}/voice`, { recursive: true });
mkdirSync("docs", { recursive: true });

/** Renders one line of narration; returns its length in ms (0 without --voice). */
let clipCount = 0;
function render(text) {
  if (!VOICE) return { file: null, ms: 0 };
  const file = `${TMP}/voice/${String(clipCount++).padStart(2, "0")}.aiff`;
  execFileSync("say", ["-v", VOICE_NAME, "-r", "172", "-o", file, text]);
  const info = execFileSync("afinfo", [file]).toString();
  const seconds = Number(/estimated duration: ([\d.]+)/.exec(info)?.[1] ?? 0);
  return { file, ms: Math.round(seconds * 1000) };
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: SIZE, colorScheme: "light", recordVideo: { dir: TMP, size: SIZE } });
const page = await context.newPage();
const t0 = Date.now(); // the video starts when the page is created
const clips = []; // { file, at } for the audio mix
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

/** Shows a caption and speaks it; the scene lasts at least `minMs`, or as long as the line takes. */
async function say(caption, { spoken = caption, minMs = 3500 } = {}) {
  const clip = render(spoken);
  await overlay();
  await page.evaluate((t) => {
    const el = document.getElementById("demo-caption");
    el.textContent = t;
    el.style.opacity = "1";
  }, caption);
  if (clip.file) clips.push({ file: clip.file, at: Date.now() - t0 });
  await wait(Math.max(minMs, clip.ms + 500));
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

// Landing
await page.goto(BASE);
await wait(800);
await say("Product Owners face two questions every sprint: were our stories ready, and did we stick to what we committed?");
await say("Sprintwise answers both with data. No Jira setup: paste a story or upload a CSV.");
await click(page.getByRole("link", { name: "Try the demo" }));

// Backlog
await page.waitForURL(/\/demo/);
await say("Every story gets a score out of 100 from nine fixed rules. The weakest stories come first.");
await click(page.getByRole("button", { name: /TIDY-103/ }));
await say("This one uses vague words like 'fast' and 'easy', and states no benefit, so it scores 50.");
await say("No AI sets the score: the same story always scores the same, and every lost point has a reason.", {
  spoken: "No A.I. sets the score. The same story always scores the same, and every lost point has a reason.",
});

// Score your own
await scrollTo("#try-it");
await say("You can score your own story. It runs in the browser; nothing is sent or saved.", { minMs: 3000 });
const title = page.getByLabel("Title");
await click(title);
await title.pressSequentially("Make invoice export fast", { delay: 45 });
await click(page.getByRole("button", { name: "Score this story" }));
await say("A vague one-line story scores low…", { minMs: 2500 });
const description = page.getByLabel("Description");
await click(description);
await description.pressSequentially("As a finance admin I want to export an invoice as a PDF so that I can email it to a client", {
  delay: 18,
});
const criteria = page.getByLabel(/Acceptance criteria/);
await click(criteria);
await criteria.pressSequentially("- The PDF downloads within 3 seconds\n- It matches the invoice on screen", { delay: 18 });
await click(page.getByLabel("Story points"));
await page.getByLabel("Story points").pressSequentially("3", { delay: 60 });
await click(page.getByRole("button", { name: "Score this story" }));
await say("…and the score climbs as the story gets clear. Only the word 'fast' still costs points.", {
  spoken: "And the score climbs as the story gets clear. Only the word fast still costs points.",
});

// Sample sprint
await scrollTo("#sample-sprint");
await say("On day one the team locks a baseline it can't edit. Later CSV snapshots are compared against it, story by story.");
await pointAt(page.getByRole("region", { name: "Sprint metrics" }));
await say("Here scope grew 18.8%, churn was 50%, and only 37.5% of the original commitment was done.", {
  spoken: "Here, scope grew 18.8 percent, churn was 50 percent, and only 37.5 percent of the original commitment was done.",
});
await pointAt(page.getByText(/40 points lower/));
await say("And the finding that matters: the stories that changed scored 40 points lower before planning.");

// Report
await click(page.getByRole("link", { name: "Open the sprint report" }));
await page.waitForURL(/\/demo\/report/);
await say("It all fits on one printable page for the retrospective.");
await pointAt(page.getByRole("button", { name: "Print or save as PDF" }));
await wait(1000);

// Close
await page.goto(BASE);
await say("I owned the requirements, backlog and testing end to end. Every rule and metric has an automated test.");
await say("Sprintwise: sprintwise-omega.vercel.app · code on github.com/NaderAbsy/sprintwise", {
  spoken: "Sprintwise. Try the demo, and find the code, at the links below.",
  minMs: 4500,
});

const video = page.video();
await context.close();
await browser.close();
const silent = `${TMP}/silent.webm`;
renameSync(await video.path(), silent);

if (!VOICE) {
  renameSync(silent, `${OUT}.webm`);
  console.log(`Saved ${OUT}.webm (captions only)`);
} else {
  // Lay each line at the moment its caption appeared, mix them into one track, and encode MP4 and WebM.
  const inputs = clips.flatMap((c) => ["-i", c.file]);
  const delayed = clips.map((c, i) => `[${i + 1}:a]adelay=${c.at}|${c.at}[a${i}]`).join(";");
  const mix = `${delayed};${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,apad[voice]`;
  const common = ["-y", "-i", silent, ...inputs, "-filter_complex", mix, "-map", "0:v", "-map", "[voice]", "-shortest"];
  execFileSync("ffmpeg", [...common, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", `${OUT}.mp4`], { stdio: "ignore" });
  execFileSync("ffmpeg", [...common, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-c:a", "libopus", "-b:a", "96k", `${OUT}.webm`], { stdio: "ignore" });
  console.log(`Saved ${OUT}.mp4 and ${OUT}.webm with a ${VOICE_NAME} voice-over (${clips.length} lines)`);
}
rmSync(TMP, { recursive: true, force: true });
