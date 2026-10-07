import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test("a read-only backlog link shows the team every unfinished story and what to fix, until it's turned off", async ({ page, browser }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Refinement");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: /load 12 sample stories/ }).click();
  await expect(page.getByText("Imported and scored 12 stories.")).toBeVisible();

  await page.getByRole("button", { name: "Share" }).click();
  const dialog = page.getByRole("dialog", { name: "Share this backlog" });
  await expect(dialog).toContainText("Not your sprints, settings or other projects.");
  await dialog.getByRole("button", { name: "Create link" }).click();
  const link = await dialog.getByLabel("Link").inputValue();
  expect(link).toMatch(/\/share\/backlog\/[A-Za-z0-9_-]{43}$/);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Shared" })).toBeVisible();

  // Someone without an account opens it.
  const strangerContext = await browser.newContext();
  const stranger = await strangerContext.newPage();
  const response = await stranger.goto(link);
  expect(response?.status()).toBe(200);
  await expect(stranger.getByRole("heading", { level: 1, name: "Refinement" })).toBeVisible();
  await expect(stranger.getByText(/of 12 stories ready for planning/)).toBeVisible();
  await expect(stranger.locator("main details")).toHaveCount(12);
  await stranger.getByRole("link", { name: "Weakest first" }).click();
  await expect(stranger.locator("main details").first()).toContainText("TIDY-105");
  await stranger.locator("main details summary").first().click();
  await expect(stranger.locator("main details").first().getByRole("heading", { name: "What to fix" })).toBeVisible();
  await expect(stranger.getByRole("link", { name: /Edit|Delete|Import/ })).toHaveCount(0);
  await expectAccessible(stranger);

  // Turned off: the link is gone.
  await page.getByRole("button", { name: "Shared" }).click();
  await page.getByRole("dialog", { name: "Share this backlog" }).getByRole("button", { name: "Turn off the link" }).click();
  await expect(page.getByRole("dialog", { name: "Share this backlog" }).getByRole("button", { name: "Create link" })).toBeVisible();
  const gone = await stranger.goto(link);
  expect(gone?.status()).toBe(404);
  await strangerContext.close();
});
