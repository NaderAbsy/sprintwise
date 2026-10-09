// Records the demo video (docs/demo-video-script.md) from a local production build.
//
//   pnpm record-demo [base URL]            captions only, WebM
//   pnpm record-demo --voice [base URL]    adds a natural AI voice-over, MP4 + WebM
//                                          (Kokoro, an open-source neural voice that runs locally)
//
// The base URL (default http://localhost:3100) must be a build with test sign-in and the pretend
// Jira switched on, as the end-to-end tests use:
//   ENABLE_TEST_SIGN_IN=true JIRA_FAKE=true BETTER_AUTH_URL=http://localhost:3100 pnpm build
//   ENABLE_TEST_SIGN_IN=true JIRA_FAKE=true BETTER_AUTH_URL=http://localhost:3100 pnpm start --port 3100
// The public pages are filmed signed out. Then the browser signs in as a test user set up beforehand,
// off camera, with invented projects, sprints and stories, and films the signed-in pages. Nothing on
// screen is real data, and nothing touches the live site.
//
// Both need a full ffmpeg (brew install ffmpeg): the blank start, while the first page loads, is cut.
//
// Each scene lasts as long as its narration, and every caption repeats what's said, so the
// video also works muted. Pick another Kokoro voice with DEMO_VOICE, e.g. "am_michael" or "bf_emma".
// The first --voice run downloads the model (~300 MB) from Hugging Face and caches it.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";

const args = process.argv.slice(2);
const VOICE = args.includes("--voice");
const BASE = args.find((a) => !a.startsWith("--")) ?? "http://localhost:3100";
const VOICE_NAME = process.env.DEMO_VOICE ?? "af_heart";
const SIZE = { width: 1440, height: 900 };
const TMP = "test-results/demo-video";
const OUT = "docs/demo";

rmSync(TMP, { recursive: true, force: true });
mkdirSync(`${TMP}/voice`, { recursive: true });
mkdirSync("docs", { recursive: true });

/**
 * Every line of narration, generated before recording starts so the video never waits on the voice.
 * Captions show `caption`; the voice reads `spoken` when it differs (numbers and web addresses).
 * The same file is the transcript under the video on the home page, so the two can't drift apart.
 */
const LINES = JSON.parse(readFileSync("src/demo/video-lines.json", "utf8"));

const voiced = {};
if (VOICE) {
  const { KokoroTTS } = await import("kokoro-js");
  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" });
  for (const [key, line] of Object.entries(LINES)) {
    const file = `${TMP}/voice/${key}.wav`;
    const audio = await tts.generate(line.spoken ?? line.caption, { voice: VOICE_NAME, speed: 1 });
    await audio.save(file);
    const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
    voiced[key] = { file, ms: Math.round(seconds * 1000) };
  }
  console.log(`Generated ${Object.keys(voiced).length} lines with Kokoro (${VOICE_NAME})`);
}

const csv = (rows) => ({ name: "sprint.csv", mimeType: "text/csv", buffer: Buffer.from(["key,title,story_points,status", ...rows].join("\n")) });

/** Three finished sprints of invented work, so the planning helper has a velocity to show. */
const PAST_SPRINTS = [
  {
    name: "Sprint 9",
    start: "2026-08-31",
    end: "2026-09-11",
    baseline: ["TIDY-81,Search cleaners by area,5,To Do", "TIDY-82,Show prices before booking,3,To Do", "TIDY-83,Email a booking receipt,5,To Do", "TIDY-84,Cleaner sees today's jobs,3,To Do", "TIDY-85,Reschedule a booking,2,To Do"],
    done: ["TIDY-81,Search cleaners by area,5,Done", "TIDY-82,Show prices before booking,3,Done", "TIDY-83,Email a booking receipt,5,Done", "TIDY-84,Cleaner sees today's jobs,3,Done", "TIDY-85,Reschedule a booking,2,In Progress"],
  },
  {
    name: "Sprint 10",
    start: "2026-09-14",
    end: "2026-09-25",
    baseline: ["TIDY-86,Save a favourite cleaner,5,To Do", "TIDY-87,Booking reminders by text,5,To Do", "TIDY-88,Add a second address,3,To Do", "TIDY-89,Cleaner marks a job done,3,To Do", "TIDY-90,Refund a cancelled booking,2,To Do"],
    done: ["TIDY-86,Save a favourite cleaner,5,Done", "TIDY-87,Booking reminders by text,5,Done", "TIDY-88,Add a second address,3,In Progress", "TIDY-89,Cleaner marks a job done,3,Done", "TIDY-90,Refund a cancelled booking,2,Done"],
  },
  {
    name: "Sprint 11",
    start: "2026-09-28",
    end: "2026-10-09",
    baseline: ["TIDY-91,Pay with Apple Pay,8,To Do", "TIDY-92,Cleaner uploads a photo,3,To Do", "TIDY-93,Share a booking link,3,To Do", "TIDY-94,Show the cleaner's languages,2,To Do", "TIDY-95,Cancel a recurring booking,2,To Do"],
    done: ["TIDY-91,Pay with Apple Pay,8,Done", "TIDY-92,Cleaner uploads a photo,3,Done", "TIDY-93,Share a booking link,3,Done", "TIDY-94,Show the cleaner's languages,2,Done", "TIDY-95,Cancel a recurring booking,2,To Do"],
  },
];

/** Off camera: a test user with an empty "Online shop" project and a "Tidyhome app" with sample stories and past sprints. */
async function setUp(browser) {
  const context = await browser.newContext({ viewport: SIZE, baseURL: BASE });
  const page = await context.newPage();
  const id = randomBytes(6).toString("hex");
  const signUp = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: BASE },
    data: { email: `demo-${id}@example.test`, password: `demo-password-${id}`, name: "Sam Taylor" },
  });
  if (!signUp.ok()) throw new Error(`Test sign-in failed (${signUp.status()}). Is ${BASE} a build with ENABLE_TEST_SIGN_IN=true?`);

  const createProject = async (name) => {
    await page.goto("/projects");
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/?]+/);
    return new URL(page.url()).pathname;
  };
  const shop = await createProject("Online shop");
  const tidy = await createProject("Tidyhome app");
  await page.getByRole("button", { name: /load 12 sample stories/ }).click();
  await page.getByText("Imported and scored 12 stories.").waitFor();

  const newSprint = async (name, start, end) => {
    await page.goto(`${tidy}/sprints/new`);
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Start date").fill(start);
    await page.getByLabel("End date").fill(end);
    await page.getByRole("button", { name: "Create sprint" }).click();
    await page.getByText("Where are the stories?").waitFor();
    return new URL(page.url()).pathname;
  };
  for (const sprint of PAST_SPRINTS) {
    await newSprint(sprint.name, sprint.start, sprint.end);
    await page.getByText("Upload a CSV", { exact: true }).click();
    await page.getByLabel("Day-one CSV").setInputFiles(csv(sprint.baseline));
    await page.getByLabel("As of").fill(sprint.start);
    await page.getByRole("button", { name: "Lock as baseline" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Lock baseline" }).click();
    await page.getByText("Baseline · locked").waitFor();
    await page.getByText("Upload a CSV", { exact: true }).click();
    await page.getByLabel("Snapshot CSV").setInputFiles(csv(sprint.done));
    await page.getByLabel("As of").fill(sprint.end);
    await page.getByRole("button", { name: "Save snapshot" }).click();
    await page.getByText(/Snapshot saved/).waitFor();
  }
  const next = await newSprint("Sprint 12", "2026-10-12", "2026-10-23");

  const { cookies } = await context.storageState();
  await context.close();
  return { cookies, shop, tidy, next };
}

const browser = await chromium.launch();
const signedIn = await setUp(browser);
const context = await browser.newContext({ viewport: SIZE, baseURL: BASE, colorScheme: "light", recordVideo: { dir: TMP, size: SIZE } });
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

/** Shows a caption and plays its line; the scene lasts at least `minMs`, or as long as the line takes. */
async function say(key) {
  const line = LINES[key];
  const clip = voiced[key];
  await overlay();
  await page.evaluate((t) => {
    const el = document.getElementById("demo-caption");
    el.textContent = t;
    el.style.opacity = "1";
  }, line.caption);
  if (clip) clips.push({ file: clip.file, at: Date.now() - t0 });
  await wait(Math.max(line.minMs ?? 3500, (clip?.ms ?? 0) + 600));
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

/** Fades the caption out, so a line never stays on screen into the next scene. */
async function hush() {
  await page.evaluate(() => {
    const el = document.getElementById("demo-caption");
    if (el) el.style.opacity = "0";
  });
}

async function scrollTo(selector) {
  await hush();
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ behavior: "smooth", block: "start" }), selector);
  await wait(1200);
}

/** Opens a page and waits until it has settled, so no loading skeleton is filmed. */
async function open(path) {
  await hush();
  await page.goto(path);
  // Outside sites keep connections open, so for them "loaded" is enough.
  await page.waitForLoadState(path.startsWith("http") ? "load" : "networkidle");
  await overlay();
}

// Landing, signed out
await page.goto("/");
// The recording starts on a blank page while the first one loads; everything before this moment is cut.
await page.waitForLoadState("networkidle");
const trimMs = Date.now() - t0;
await wait(800);
await say("intro");
await say("answer");
await pointAt(page.getByRole("region", { name: "A draft that reads well isn't a story the team can start" }));
await say("aiDraft");

// Demo backlog
await click(page.getByRole("link", { name: "Try the demo" }).first());
await page.waitForURL(/\/demo/);
await say("rules");
await click(page.getByRole("button", { name: /TIDY-103/ }));
await say("weak");
await say("noAi");

// Score your own
await scrollTo("#try-it");
const title = page.getByLabel("Title");
await click(title);
await title.pressSequentially("Make invoice export fast", { delay: 45 });
await click(page.getByRole("button", { name: "Score this story" }));
await say("tryIt");
await hush();
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
await say("climbs");

// Sample sprint and trends
await scrollTo("#sample-sprint");
await say("baseline");
await pointAt(page.getByRole("region", { name: "Sprint metrics" }));
await say("metrics");
await pointAt(page.getByText(/40 points lower/));
await say("finding");
await scrollTo("#trends");
await say("trends");

// Report
await open("/demo/report");
await say("report");
await pointAt(page.getByRole("button", { name: "Print or save as PDF" }));
await wait(800);

// Signed in: the same browser now carries the test user's session.
await context.addCookies(signedIn.cookies);

// Jira (the pretend Jira, with four invented issues)
await open(`${signedIn.shop}/import`);
const jira = page.getByRole("region", { name: "From Jira" });
await pointAt(jira.getByLabel("Search (JQL)"));
await say("jira");
await hush();
await click(jira.getByRole("button", { name: "Preview issues" }));
await page.getByRole("button", { name: /Import 3 stories/ }).waitFor();
await click(page.getByRole("button", { name: /Import 3 stories/ }));
await page.getByText("Imported and scored 3 stories.").waitFor();
await wait(1500);

// Refinement
await open(`${signedIn.tidy}/refine`);
await say("refine");
await page.keyboard.press("ArrowRight");
await wait(1200);

// Share
await open(signedIn.tidy);
await click(page.getByRole("button", { name: "Share" }));
const share = page.getByRole("dialog", { name: "Share this backlog" });
await click(share.getByRole("button", { name: "Create link" }));
// Filmed on a local build, so show the address the live site would give.
await share.getByLabel("Link").evaluate((el, live) => (el.value = el.value.replace(location.origin, live)), "https://sprintwise-omega.vercel.app");
await say("share");
await click(share.getByRole("button", { name: "Done" }));

// Planning helper
await open(signedIn.next);
for (const key of ["TIDY-101", "TIDY-102", "TIDY-104", "TIDY-109"]) {
  await click(page.getByRole("checkbox", { name: new RegExp(key) }));
}
await pointAt(page.getByText(/the team usually finishes/));
await say("planning");

// Close
await open("https://github.com/NaderAbsy/sprintwise");
await wait(3000); // the file list fills in after the page loads
await say("owner");
await open("/");
await say("close");

const video = page.video();
await context.close();
await browser.close();
const silent = `${TMP}/silent.webm`;
renameSync(await video.path(), silent);

const trim = ["-ss", (trimMs / 1000).toFixed(2)];
if (!VOICE) {
  execFileSync("ffmpeg", ["-y", ...trim, "-i", silent, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", `${OUT}.webm`], { stdio: "ignore" });
  console.log(`Saved ${OUT}.webm (captions only)`);
} else {
  // Lay each line at the moment its caption appeared, mix them into one track, and encode MP4 and WebM.
  const inputs = clips.flatMap((c) => ["-i", c.file]);
  const at = (c) => Math.max(0, c.at - trimMs);
  const delayed = clips.map((c, i) => `[${i + 1}:a]adelay=${at(c)}|${at(c)}[a${i}]`).join(";");
  const mix = `${delayed};${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,apad[voice]`;
  const common = ["-y", ...trim, "-i", silent, ...inputs, "-filter_complex", mix, "-map", "0:v", "-map", "[voice]", "-shortest"];
  execFileSync("ffmpeg", [...common, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", `${OUT}.mp4`], { stdio: "ignore" });
  execFileSync("ffmpeg", [...common, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-c:a", "libopus", "-b:a", "96k", `${OUT}.webm`], { stdio: "ignore" });
  console.log(`Saved ${OUT}.mp4 and ${OUT}.webm with a Kokoro ${VOICE_NAME} voice-over (${clips.length} lines)`);
}
rmSync(TMP, { recursive: true, force: true });
