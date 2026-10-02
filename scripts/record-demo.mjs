// Records the demo video (docs/demo-video-script.md) from the live site.
//
//   pnpm record-demo [base URL]            captions only, WebM (needs nothing else)
//   pnpm record-demo --voice [base URL]    adds a natural AI voice-over, MP4 + WebM
//                                          (Kokoro, an open-source neural voice that runs locally;
//                                          needs a full ffmpeg: brew install ffmpeg)
//
// Only the public demo is used, so every story and number on screen is invented sample data.
// Each scene lasts as long as its narration, and every caption repeats what's said, so the
// video also works muted. Pick another Kokoro voice with DEMO_VOICE, e.g. "am_michael" or "bf_emma".
// The first --voice run downloads the model (~300 MB) from Hugging Face and caches it.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";

const args = process.argv.slice(2);
const VOICE = args.includes("--voice");
const BASE = args.find((a) => !a.startsWith("--")) ?? "https://sprintwise-omega.vercel.app";
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

async function scrollTo(selector) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ behavior: "smooth", block: "start" }), selector);
  await wait(1200);
}

// Landing
await page.goto(BASE);
await wait(800);
await say("intro");
await say("answer");
await click(page.getByRole("link", { name: "Try the demo" }));

// Backlog
await page.waitForURL(/\/demo/);
await say("rules");
await click(page.getByRole("button", { name: /TIDY-103/ }));
await say("weak");
await say("noAi");

// Score your own
await scrollTo("#try-it");
await say("tryIt");
const title = page.getByLabel("Title");
await click(title);
await title.pressSequentially("Make invoice export fast", { delay: 45 });
await click(page.getByRole("button", { name: "Score this story" }));
await say("vague");
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

// Sample sprint
await scrollTo("#sample-sprint");
await say("baseline");
await pointAt(page.getByRole("region", { name: "Sprint metrics" }));
await say("metrics");
await pointAt(page.getByText(/40 points lower/));
await say("finding");

// Report
await click(page.getByRole("link", { name: "Open the sprint report" }));
await page.waitForURL(/\/demo\/report/);
await say("report");
await pointAt(page.getByRole("button", { name: "Print or save as PDF" }));
await wait(1000);

// Close
await page.goto(BASE);
await say("owner");
await say("close");

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
  console.log(`Saved ${OUT}.mp4 and ${OUT}.webm with a Kokoro ${VOICE_NAME} voice-over (${clips.length} lines)`);
}
rmSync(TMP, { recursive: true, force: true });
