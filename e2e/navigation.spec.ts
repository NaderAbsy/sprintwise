import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const HOME_HEADING = "Were we ready, and did we stick to it?";

async function logoGoesHome(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole("link", { name: "Sprintwise", exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: HOME_HEADING })).toBeVisible();
}

test("the logo leads home from every public page", async ({ page }) => {
  for (const path of ["/product", "/guide", "/demo", "/demo/report", "/changelog", "/about", "/privacy", "/not-a-page"]) {
    await logoGoesHome(page, path);
  }
});

test("signed in, the logo leads home from every part of the app, and home links back", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Navigation");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: /load 12 sample stories/ }).click();
  await expect(page.getByText("Imported and scored 12 stories.")).toBeVisible();
  const project = page.url().split("?")[0];

  await page.getByRole("link", { name: /TIDY-101/ }).click();
  const story = page.url();
  await page.goto(`${project}/sprints/new`);
  await page.getByLabel("Name").fill("Sprint 1");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await page.getByRole("checkbox", { name: /TIDY-101/ }).check();
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Lock baseline" }).click();
  await expect(page.getByRole("region", { name: "Sprint metrics" })).toBeVisible();
  const sprint = page.url();

  for (const path of [
    "/projects",
    project,
    story,
    `${story}/edit`,
    `${project}/stories/new`,
    `${project}/sprints`,
    sprint,
    `${sprint}/report`,
    `${project}/trends`,
    `${project}/import`,
    `${project}/settings`,
    "/account",
    "/guide",
  ]) {
    await logoGoesHome(page, path);
  }

  // Signed in, home offers the way back into the app instead of sign-in.
  await expect(page.getByRole("main").getByRole("button", { name: "Sign in with GitHub" })).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: "Open your projects" }).click();
  await expect(page).toHaveURL(/\/projects$/);
});

test("on a phone, the logo in the app's top bar leads home", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await logoGoesHome(page, "/projects");
});

test("a click answers at once: the tab lights up and a placeholder shows while the page loads", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Quick clicks");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  await page.waitForLoadState("networkidle");

  // Hold the Trends page for two seconds, as a slow connection would (prefetches still go through).
  await page.route(/\/trends/, async (route) => {
    if (!route.request().headers()["next-router-prefetch"]) await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });
  const tabs = page.getByRole("navigation", { name: "Project sections" });
  await tabs.getByRole("link", { name: "Trends" }).click();
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: "Loading…" })).toBeVisible({ timeout: 1000 });
  await expect(tabs.getByRole("link", { name: "Trends" })).toHaveAttribute("aria-current", "page", { timeout: 1000 });
  await expect(tabs.locator("[aria-current=page]")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Trends" })).toBeVisible();
});
