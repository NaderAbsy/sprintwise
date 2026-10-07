import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test("refinement mode walks the stories that aren't ready, records the team's estimate, and edits come back to it", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Refine");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: /load 12 sample stories/ }).click();
  await expect(page.getByText("Imported and scored 12 stories.")).toBeVisible();

  await page.getByRole("link", { name: "Refinement" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Refinement" })).toBeVisible();
  // Seven of the twelve samples aren't Ready; the walk starts with the first in priority order.
  await expect(page.getByText("Story 1 of 7")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Backlog" })).toHaveAttribute("aria-current", "page");
  await expectAccessible(page);

  // Go to the unestimated story and record the team's size with a click, then with a key.
  await page.getByRole("link", { name: "All unfinished" }).click();
  await expect(page.getByText("Story 1 of 12")).toBeVisible();
  // Next story until Admin dashboard, waiting for each page so no click is ahead of the screen.
  for (let n = 1; !(await page.getByRole("heading", { level: 2, name: "Admin dashboard" }).isVisible()); n++) {
    await page.getByRole("link", { name: "Next story" }).click();
    await expect(page.getByText(`Story ${n + 1} of 12`)).toBeVisible();
  }
  const estimate = page.getByRole("group", { name: "The team's estimate" });
  await expect(estimate.getByRole("button", { pressed: true })).toHaveCount(0);
  await expect(page.getByText("Not estimated yet.")).toBeVisible();
  await estimate.getByRole("button", { name: "3", exact: true }).click();
  await expect(page.getByText("Saved: 3 points.")).toBeVisible();
  await expect(estimate.getByRole("button", { name: "3", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("5");
  await expect(page.getByText("Saved: 5 points.")).toBeVisible();
  // The estimate is saved, and marked as an edit to copy back to Jira.
  await page.reload();
  await expect(estimate.getByRole("button", { name: "5", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Current estimate: 5 points.")).toBeVisible();

  // Edit from refinement and land back on the same story.
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Description").fill("As a cleaning company owner I want to see this week's bookings so that I can plan staff");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/refine\?story=/);
  await expect(page.getByRole("heading", { level: 2, name: "Admin dashboard" })).toBeVisible();

  // Arrow keys move; the end shows where the backlog stands.
  await expect(page.getByText(/^Story \d+ of 12$/)).toBeVisible();
  const position = Number((await page.getByText(/^Story \d+ of 12$/).textContent())!.match(/\d+/)![0]);
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText(`Story ${position - 1} of 12`)).toBeVisible();
  for (let n = position - 1; n < 12; n++) {
    await page.getByRole("link", { name: "Next story" }).click();
    await expect(page.getByText(`Story ${n + 1} of 12`)).toBeVisible();
  }
  await page.getByRole("link", { name: "Finish", exact: true }).click();
  await expect(page.getByText("That's the lot.")).toBeVisible();
  await expect(page.getByText(/of 12 unfinished stories are Ready/)).toBeVisible();
});
