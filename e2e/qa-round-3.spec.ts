import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/** Found by a third round (2026-10-13): a hostile user, things going wrong, real-sized data, first impressions. */

async function newProject(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  return page.url().split("?")[0];
}

const offline = (page: Page) => page.route("**/*", (route) => (route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue()));

test("a save that can't reach Sprintwise keeps the typing and says so", async ({ page }) => {
  const project = await newProject(page, "Offline");
  await page.goto(`${project}/stories/new`);
  await page.getByLabel("Title").fill("Typed carefully");
  await page.getByLabel("Description").fill("As a PO I want my typing kept so that I don't redo it.");
  await offline(page);
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByText(/Couldn't save: you may be offline, or signed out\. What you typed is still here\./)).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Typed carefully");
  await expect(page.getByLabel("Description")).toHaveValue("As a PO I want my typing kept so that I don't redo it.");

  // Back online, the same click saves it.
  await page.unroute("**/*");
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByRole("heading", { name: "Typed carefully" })).toBeVisible();
});

test("a save after signing out keeps the typing, and a status change offline says it wasn't saved", async ({ page, context }) => {
  const project = await newProject(page, "Signed out");
  await page.goto(`${project}/stories/new`);
  await page.getByLabel("Title").fill("Status test");
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByRole("heading", { name: "Status test" })).toBeVisible();

  await page.goto(project);
  await offline(page);
  await page.getByLabel("Status of STORY-1").selectOption("Done");
  await expect(page.getByText("Couldn't save. Check your connection, then try again.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
  await page.unroute("**/*");

  await page.goto(`${project}/stories/new`);
  await page.getByLabel("Title").fill("Written over lunch");
  await context.clearCookies();
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByText(/Couldn't save: you may be offline, or signed out/)).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Written over lunch");
});

test("previewing a Jira search doesn't link the project until the issues are imported", async ({ page }) => {
  const project = await newProject(page, "Preview only");
  await page.goto(`${project}/import`);
  await page.getByRole("button", { name: "Preview issues" }).click();
  await expect(page.getByRole("button", { name: /^Import \d+ stor/ })).toBeVisible();
  // Only previewed: the backlog has no Jira bar, so Sync and Send can't use that site yet.
  await page.goto(project);
  await expect(page.getByRole("button", { name: "Sync from Jira" })).toHaveCount(0);

  await page.goto(`${project}/import`);
  await page.getByRole("button", { name: "Preview issues" }).click();
  await page.getByRole("button", { name: /^Import \d+ stor/ }).click();
  await expect(page).toHaveURL(/imported=/);
  await expect(page.getByRole("button", { name: "Sync from Jira" })).toBeVisible();
});

test("invisible characters in a key are dropped, and a long link doesn't widen a phone screen", async ({ page }) => {
  const project = await newProject(page, "Odd text");
  await page.goto(`${project}/stories/new`);
  await page.getByLabel("Key").fill("zw​-1");
  await page.getByLabel("Title").fill("Pay with a saved card 💳");
  await page
    .getByLabel("Description")
    .fill("As a shopper I want to pay with a saved card so that checkout is quick. https://example.atlassian.net/wiki/spaces/PAY/pages/123456789/A+very+long+confluence+page+title+with+no+spaces+at+all");
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByText("ZW-1", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/^ZW-1 · Story/);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByRole("heading", { name: /Pay with a saved card/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("search engines and link previews get the right basics", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Sprintwise: user story readiness checker for Product Owners");
  const structured = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(structured["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual(["WebSite", "SoftwareApplication", "FAQPage"]);
  expect(JSON.stringify(structured)).toContain("Definition of Ready");
  expect(structured["@graph"][1]).toMatchObject({ name: "Sprintwise", offers: { price: "0" } });
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Nader Absy" })).toHaveAttribute("href", "https://naderabsy.com");
  await page.goto("/demo");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /invented backlog/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /projects");
  expect(robots).toContain("Sitemap:");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("/demo</loc>");
  expect((await request.get("/apple-icon")).headers()["content-type"]).toContain("image/png");
});
