import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test("a story can be edited, with the score updating as you type", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Editing");
  await page.getByRole("button", { name: "Create project" }).click();

  await page.getByRole("link", { name: "Score a story" }).first().click();
  const live = page.getByRole("complementary", { name: "Live score" });
  await page.getByLabel("Title").fill("Make checkout fast");
  await expect(live.getByText("Not ready")).toBeVisible();
  await expect(live.getByText('The story uses vague words: "fast".', { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Make checkout fast/ })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("link", { name: "Edit story" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Make checkout fast");
  await page.getByLabel("Title").fill("Pay with a saved card");
  await page
    .getByLabel("Description")
    .fill("As a returning customer I want to pay with a saved card so that checkout takes one step");
  await page.getByLabel(/Acceptance criteria/).fill("- The saved card is offered first\n- Paying takes one click");
  await page.getByLabel("Story points").fill("3");
  await expect(live.getByText("Every check passed.")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("status")).toHaveText("Changes saved and the story re-scored.");
  await expect(page.getByRole("heading", { level: 1, name: /Pay with a saved card/ })).toBeVisible();
  await page.getByRole("link", { name: "Backlog", exact: true }).first().click();
  await expect(page.getByText("1 of 1 story ready.", { exact: false })).toBeVisible();
});

test("a new user can run a whole sprint without a CSV, guided by the checklist", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("No Jira team");
  await page.getByRole("button", { name: "Create project" }).click();

  const checklist = page.getByRole("region", { name: "Getting started" });
  await expect(checklist.getByText("0 of 4 done")).toBeVisible();
  await page.getByRole("button", { name: /load 12 sample stories/ }).click();
  await expect(page.getByText("Imported and scored 12 stories.")).toBeVisible();
  await expect(checklist.getByText("1 of 4 done")).toBeVisible();

  // The new sprint form is pre-filled with a two-week sprint.
  await checklist.getByRole("link", { name: "New sprint" }).click();
  await expect(page.getByLabel("Start date")).not.toHaveValue("");
  await expect(page.getByLabel("End date")).not.toHaveValue("");
  await page.getByLabel("Name").fill("Sprint 1");
  await page.getByRole("button", { name: "Create sprint" }).click();

  // Baseline from the backlog: no file needed.
  await expect(page.getByRole("radio", { name: "From the backlog" })).toBeChecked();
  for (const key of ["TIDY-101", "TIDY-102", "TIDY-104"]) await page.getByRole("checkbox", { name: new RegExp(key) }).check();
  await expect(page.getByText("3 stories, 10 points in total")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Lock baseline" }).click();
  await expect(page.getByText("Baseline 10 points · latest snapshot 10 points")).toBeVisible();
  const sprintUrl = page.url();

  // Mark one story Done in the backlog: the sprint records it by itself.
  await page.goto(sprintUrl.replace(/\/sprints\/.*/, ""));
  await page.getByRole("link", { name: /TIDY-102/ }).click();
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Status").fill("Done");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  await page.goto(sprintUrl);
  await expect(page.getByRole("region", { name: "Change log" })).toContainText("TIDY-102");
  await expect(page.getByRole("region", { name: "Sprint metrics" }).getByText("30.0%")).toBeVisible();

  // Adding a story still goes through "Add or remove stories".
  await expect(page.getByRole("checkbox", { name: /TIDY-102/ })).toBeChecked();
  await page.getByRole("checkbox", { name: /TIDY-103/ }).check();
  await expect(page.getByRole("table", { name: "Changes since the previous snapshot" })).toContainText("TIDY-103");
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText("Snapshot saved with 1 change.")).toBeVisible();

  // Every step done: the checklist steps aside.
  await page.goto(sprintUrl.replace(/\/sprints\/.*/, ""));
  await expect(page.getByRole("heading", { level: 1, name: "Backlog" })).toBeVisible();
  await expect(checklist).toHaveCount(0);
});
