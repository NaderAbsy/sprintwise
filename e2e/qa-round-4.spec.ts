import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/** Found by a fourth round (2026-10-26): the public site through a first-time Product Owner's eyes. */

test("the public pages are served ready-made, not rendered per visit", async ({ request }) => {
  for (const path of ["/", "/demo", "/product", "/guide", "/about", "/privacy"]) {
    const response = await request.get(path);
    expect(response.headers()["cache-control"], path).not.toContain("no-store");
  }
});

test("the demo and the home page end with a way to sign up", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Ready to check your own backlog?" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("main").getByRole("button", { name: "Sign in with GitHub" })).toHaveCount(2);
  await expect(page.getByRole("main").getByRole("link", { name: "Read the code" })).toHaveCount(0);
});

test("signed in, the demo's ending opens the app instead", async ({ page }) => {
  await signIn(page);
  await page.goto("/demo");
  await expect(page.getByRole("main").getByRole("link", { name: "Open your projects" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Sign in with GitHub" })).toHaveCount(0);
});

test("on a phone, all four demo tabs fit without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/demo");
  const tabs = page.getByRole("navigation", { name: "Demo sections" }).getByRole("list");
  expect(await tabs.evaluate((list) => list.scrollWidth - list.clientWidth)).toBeLessThanOrEqual(0);
});

test("a mistyped address offers the home page and the demo, not a sign-in loop", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try the demo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Your projects" })).toHaveCount(0);
});

test("privacy says where data is stored, and the sitemap lists the sample report", async ({ page, request }) => {
  await page.goto("/privacy");
  await expect(page.getByText(/stored in the EU/)).toBeVisible();
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/demo/report</loc>");
  // Only the changelog carries a date: the other pages don't change with each release.
  expect(sitemap.match(/<lastmod>/g)).toHaveLength(1);
});
