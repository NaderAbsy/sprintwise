import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test("the demo opens without signing in and saves nothing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText("5 of 12 stories ready")).toBeVisible();
  await expect(page.getByText("Demo: invented sample data, nothing is saved")).toBeVisible();

  // The weakest story is listed first and open by default.
  await expect(page.getByRole("heading", { name: "TIDY-105 Admin dashboard" })).toBeVisible();

  await page.getByRole("button", { name: /TIDY-103/ }).click();
  await expect(page.getByText('The story uses vague words: "fast", "quick", "easy", "user-friendly".')).toBeVisible();
});

test("the demo scores a pasted story in the browser", async ({ page }) => {
  await page.goto("/demo");
  const requests: string[] = [];
  // Link prefetches are GETs; scoring must not send anything.
  page.on("request", (r) => r.method() !== "GET" && requests.push(r.url()));

  await page.getByRole("button", { name: "Score this story" }).click();
  await expect(page.getByText("Paste a story title to score.")).toBeVisible();

  await page.getByLabel("Title").fill("Export invoices");
  await page.getByLabel("Description").fill("As a finance admin I want to export invoices so that I can send them to clients");
  await page.getByLabel(/Acceptance criteria/).fill("- A PDF downloads\n- It matches the screen");
  await page.getByLabel("Story points").fill("3");
  await page.getByRole("button", { name: "Score this story" }).click();

  await expect(page.getByText("Every check passed.")).toBeVisible();
  expect(requests).toEqual([]);
});

test("signed-out visitors are sent to the landing page", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/$/);
});

test("the template downloads with the frozen columns", async ({ request }) => {
  const response = await request.get("/template.csv");
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect((await response.text()).split("\n")[0]).toBe("key,title,description,acceptance_criteria,story_points,status");
});

test("F-2: the demo includes a sample sprint and its one-page report", async ({ page }) => {
  await page.goto("/demo");
  const sprint = page.getByRole("region", { name: "Sprint 12 (sample data)" });
  await expect(
    sprint.getByText("Stories that changed scored 40 points lower at the baseline than those that didn't."),
  ).toBeVisible();
  await expect(sprint.getByText("+18.8%")).toBeVisible();
  await expect(sprint.getByText("50.0%")).toBeVisible();
  await expect(sprint.getByText("37.5%")).toBeVisible();

  await sprint.getByRole("link", { name: "Open the sprint report" }).click();
  await expect(page).toHaveURL(/\/demo\/report$/);
  await expect(
    page.getByText("Scope grew 18.8%, churn was 50.0%, and 37.5% of the original commitment was done."),
  ).toBeVisible();
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)?.length).toBe(1);
});

test("the demo shows scope reasons and trends across sprints", async ({ page }) => {
  await page.goto("/demo#trends");
  const trends = page.getByRole("region", { name: "Trends across sprints" });
  await expect(trends.getByRole("img", { name: /Bar chart of committed and done points/ })).toBeVisible();
  await expect(trends.getByText(/a good sign\./).first()).toBeVisible();
  await expect(page.getByRole("table", { name: "Every change in the sample sprint, newest first" })).toContainText("Bug or incident");
  await page.goto("/demo/report");
  await expect(page.getByRole("region", { name: "Why scope changed" })).toBeVisible();
});

test("a share link that doesn't exist is a 404", async ({ page }) => {
  const response = await page.goto("/share/" + "x".repeat(43));
  expect(response?.status()).toBe(404);
});

test("the first click on Sign in with GitHub is handled", async ({ page }) => {
  // With GitHub configured (a local .env) the click goes to GitHub; without it (CI) an error shows.
  // Either way one click is enough. Requests to github.com are stubbed so the test never leaves the machine.
  await page.route("https://github.com/**", (route) => route.fulfill({ status: 200, body: "GitHub" }));
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Sign in with GitHub" }).click();
  await expect
    .poll(async () => page.url().startsWith("https://github.com/") || (await page.getByRole("alert").count()) > 0)
    .toBe(true);
});

test("the home page scores a story live as you type", async ({ page }) => {
  await page.goto("/");
  const scorer = page.getByRole("main").locator("[aria-live=polite]");
  await expect(scorer.getByText("Not ready")).toBeVisible();
  await page.getByRole("button", { name: "Ready", exact: true }).click();
  await expect(scorer.getByText("Every check passed")).toBeVisible();
  await page.getByLabel("Story title").fill("Make it fast");
  await expect(scorer.getByText("No vague words in the story: failed")).toBeAttached();
});

test("the home page has the demo video with a transcript", async ({ page }) => {
  await page.goto("/");
  const video = page.locator("video");
  await expect(video).toHaveAttribute("poster", "/media/demo-poster.webp");
  await expect(video.locator("source")).toHaveCount(2);
  for (const src of await video.locator("source").evaluateAll((els) => els.map((e) => e.getAttribute("src")))) {
    expect((await page.request.head(src!)).ok()).toBe(true);
  }
  await page.getByText("Read the transcript").click();
  await expect(page.getByText("Every story gets a score out of 100 from nine fixed rules.", { exact: false })).toBeVisible();
});

test("the header tabs reach every public page and mark the current one", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const [name, heading] of [
    ["Product", "Everything Sprintwise does, and how"],
    ["Guide", "How to use Sprintwise"],
    ["Changelog", "What's new in Sprintwise"],
    ["About", "Built by a Product Owner, for Product Owners"],
  ]) {
    await nav.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(nav.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
  }
});

test("on a phone, the menu opens, links work, and Escape closes it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open menu" });
  await toggle.click();
  await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.locator("#marketing-menu").getByRole("link", { name: "Changelog" }).click();
  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.locator("#marketing-menu")).toHaveCount(0);
});

for (const path of ["/", "/product", "/guide", "/changelog", "/about", "/demo", "/demo/report", "/privacy", "/terms"]) {
  test(`${path} has no serious accessibility issues`, async ({ page }) => {
    await page.goto(path);
    await expectAccessible(page);
  });
}

test("Send feedback opens the GitHub form from the footer and the app sidebar", async ({ page }) => {
  const form = "https://github.com/NaderAbsy/sprintwise/issues/new?template=feedback.yml";
  await page.goto("/privacy");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: /Send feedback/ })).toHaveAttribute("href", form);
  await expect(page.getByRole("heading", { name: "Visit counts" })).toBeVisible();
  // Analytics only runs on the live site, never locally or in tests.
  expect(await page.locator('script[src*="/_vercel/insights"], script[src*="va.vercel-scripts"]').count()).toBe(0);

  await signIn(page);
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: /Send feedback/ }).first()).toHaveAttribute("href", form);
});

test("the home page shows the real verdict on an AI draft", async ({ page }) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: "A draft that reads well isn't a story the team can start" });
  await expect(section).toContainText("Passes all nine rules (100 points), but held at Needs work.");
  await expect(section).toContainText("looks left over from an AI chat");
  await expect(section).toContainText("“All edge cases are handled” would fit any story");
  await expect(page.getByText("tickets sent to an AI")).toBeVisible();
});
