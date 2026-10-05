import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

async function projectWithSamples(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: /load 12 sample stories/ }).click();
  await expect(page.getByText("Imported and scored 12 stories.")).toBeVisible();
  return page.url().split("?")[0];
}

async function newSprint(page: Page, project: string) {
  await page.goto(`${project}/sprints/new`);
  await expect(page.getByText(/pick the stories the team committed to on day one/)).toBeVisible();
  await page.getByLabel("Name").fill("Sprint 1");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await expect(page.getByRole("heading", { name: "Step 1: lock the baseline" })).toBeVisible();
}

async function lock(page: Page, keys: string[]) {
  for (const key of keys) await page.getByRole("checkbox", { name: new RegExp(key) }).check();
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  await page.getByRole("dialog", { name: "Lock this baseline?" }).getByRole("button", { name: "Lock baseline" }).click();
  await expect(page.getByRole("region", { name: "Sprint metrics" })).toBeVisible();
}

async function setStatus(page: Page, project: string, title: string, status: string) {
  await page.goto(project);
  await page.getByRole("link", { name: title }).click();
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Status").fill(status);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved and the story re-scored.")).toBeVisible();
}

test("an empty projects page is one box with the form in it", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  const main = page.getByRole("main");
  await expect(main.getByText("No projects yet.")).toBeVisible();
  await expect(main.getByRole("heading", { name: "New project" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Create project" })).toHaveCount(1);
  await expectAccessible(page);
});

test("a baseline locked by mistake can be undone until the first snapshot", async ({ page }) => {
  test.setTimeout(90_000);
  const project = await projectWithSamples(page, "Undo");
  await newSprint(page, project);
  await expect(page.getByText("1 pt", { exact: true })).toBeVisible();
  await lock(page, ["TIDY-101", "TIDY-110"]);
  await expectAccessible(page);

  // Wrong story ticked: undo it and lock the right ones.
  await page.getByRole("button", { name: "Undo baseline" }).click();
  const undo = page.getByRole("dialog", { name: "Undo this baseline?" });
  await undo.getByRole("button", { name: "Undo baseline" }).click();
  await expect(page.getByRole("heading", { name: "Step 1: lock the baseline" })).toBeVisible();
  await lock(page, ["TIDY-101", "TIDY-102"]);
  await expect(page.getByText("Baseline 8 points · latest snapshot 8 points")).toBeVisible();

  // Once a later snapshot is saved, the baseline is fixed for good.
  await page.getByRole("checkbox", { name: /TIDY-107/ }).check();
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText("Snapshot saved with 1 change.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo baseline" })).toHaveCount(0);

  // Delete sits at the foot of the page, not next to the report button.
  await expect(page.getByRole("region", { name: "Delete this sprint" }).getByRole("button", { name: "Delete sprint" })).toBeVisible();
});

test("a project's own done statuses count towards completion", async ({ page }) => {
  test.setTimeout(90_000);
  const project = await projectWithSamples(page, "Released");
  await newSprint(page, project);
  await lock(page, ["TIDY-101", "TIDY-102"]);
  const sprint = page.url();

  await setStatus(page, project, "Cancel a booking", "Released");
  await page.goto(sprint);
  await page.getByRole("checkbox", { name: /TIDY-102/ }).check();
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText(/Snapshot saved with 1 change/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Sprint metrics" })).toContainText("Completion0.0%");

  await page.goto(`${project}/settings`);
  await expect(page.getByLabel("Done statuses")).toHaveValue("Done, Closed, Resolved");
  await page.getByLabel("Done statuses").fill("");
  await page.getByRole("button", { name: "Save statuses" }).click();
  await expect(page.getByText("Add at least one status, such as Done.")).toBeVisible();
  await page.getByLabel("Done statuses").fill("Done, released");
  await page.getByRole("button", { name: "Save statuses" }).click();
  await expect(page.getByText("Saved. Stories marked Done, released now count as done.")).toBeVisible();
  await expectAccessible(page);

  await page.goto(sprint);
  // TIDY-102 is 3 of the 8 committed points.
  await expect(page.getByRole("region", { name: "Sprint metrics" })).toContainText("Completion37.5%");
});

test("leaving a story with unsaved changes asks first", async ({ page }) => {
  const project = await projectWithSamples(page, "Unsaved");
  await page.getByRole("link", { name: "Admin dashboard" }).click();
  await expect(page).toHaveURL(/\/stories\/[^/]+$/);
  const story = page.url();

  // Delete is at the foot of the story page, away from Edit.
  await expect(page.getByRole("region", { name: "Delete this story" }).getByRole("button", { name: "Delete story" })).toBeVisible();

  await page.getByRole("link", { name: "Edit story" }).click();
  // Nothing typed yet: leaving doesn't ask.
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(story);

  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Title").fill("As an admin I want a bookings dashboard so that I can spot failed payments");

  // Staying keeps the typing.
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("Leave without saving?");
    void dialog.dismiss();
  });
  await page.getByRole("link", { name: "Backlog", exact: true }).first().click();
  await expect(page).toHaveURL(`${story}/edit`);
  await expect(page.getByLabel("Title")).toHaveValue(/bookings dashboard/);

  // Leaving anyway goes.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(story);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Admin dashboard");

  // Saving never asks.
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Story points").fill("3");
  let asked = false;
  page.on("dialog", (dialog) => {
    asked = true;
    void dialog.dismiss();
  });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved and the story re-scored.")).toBeVisible();
  expect(asked).toBe(false);
  await expect(page).toHaveURL(new RegExp(`${project}/stories/`));
});
