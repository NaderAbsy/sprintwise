import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/** Found by the full code review (2026-10-16): screens that lost focus, typing or the user's place. */

async function newProject(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  return page.url().split("?")[0];
}

async function withSamples(page: Page, name: string) {
  const project = await newProject(page, name);
  await page.getByRole("button", { name: /load 12 sample stories/ }).click();
  await expect(page.getByText(/Imported and scored 12 stories/)).toBeVisible();
  return project;
}

test("Enter in the import search box filters; it doesn't import everything ticked", async ({ page }) => {
  const project = await newProject(page, "Enter to search");
  await page.goto(`${project}/import`);
  const csv = ["key,title,story_points", "A-1,Pay with a saved card,3", "A-2,Refund a payment,5"].join("\n");
  await page.getByLabel("CSV file").setInputFiles({ name: "a.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByLabel("Search", { exact: true }).fill("A-2");
  await page.getByLabel("Search", { exact: true }).press("Enter");
  await expect(page.getByText("Showing 1 of 2.", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/import$/);
  await expect(page.getByText(/Imported and scored/)).toHaveCount(0);
});

test("unsaved story edits survive the Back button", async ({ page }) => {
  const project = await withSamples(page, "Back button");
  await page.getByRole("link", { name: /TIDY-101/ }).first().click();
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Book a cleaner for a slot I choose");
  await page.goBack();
  await expect(page.getByRole("link", { name: "Edit story" })).toBeVisible();
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByRole("button", { name: "Restore them" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Book a cleaner for a slot I choose");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Book a cleaner for a slot I choose" })).toBeVisible();

  // Saved, so nothing is offered next time.
  await page.getByRole("link", { name: "Edit story" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore them" })).toHaveCount(0);
  void project;
});

test("a quick points save keeps keyboard focus, and phones see the band in words", async ({ page }) => {
  const project = await withSamples(page, "Focus and phone");
  const points = page.getByLabel("Points for TIDY-101", { exact: true });
  await points.fill("2");
  await points.press("Enter");
  await expect(page.getByLabel("Points for TIDY-101 saved")).toBeVisible();
  await expect(points).toBeFocused();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(project);
  const row = page.getByRole("row", { name: /TIDY-101/ });
  await expect(row.getByText(/^(Ready|Needs work|Not ready)/).filter({ visible: true })).toBeVisible();
});

test("refinement always names the story it shows", async ({ page }) => {
  const project = await withSamples(page, "Refine address");
  await page.goto(`${project}/refine`);
  await expect(page).toHaveURL(/\/refine\?story=/);
});
