import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/** Found by a second start-to-finish run as a new Product Owner (2026-10-13), each kept fixed. */

async function newProject(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  return page.url().split("?")[0];
}

async function addStory(page: Page, project: string, title: string, points: string) {
  await page.goto(`${project}/stories/new`);
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(`As a repeat customer, I want to ${title.toLowerCase()} so that I keep someone I trust.`);
  await page.getByLabel(/Acceptance criteria/).fill("- My last cleaner is offered first\n- Rebooking takes two taps\n- A cleaner who is fully booked is marked as busy");
  await page.getByLabel("Story points").fill(points);
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("sub-tasks are left unticked at import, and criteria in the description aren't called a problem", async ({ page }) => {
  const project = await newProject(page, "Import");
  await page.goto(`${project}/import`);
  const csv = [
    "Issue key,Summary,Issue Type,Status,Description,Custom field (Story Points)",
    'MOB-1,Log in with Face ID,Story,To Do,"As a returning user I want to log in with Face ID so that I skip my password.\n\nAcceptance criteria\n* The Face ID prompt appears on the login screen\n* A failed scan falls back to the password",3',
    "MOB-2,Add the Face ID setting,Sub-task,To Do,,1",
  ].join("\n");
  await page.locator("input[type=file]").setInputFiles({ name: "jira.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("No Acceptance criteria column, so stories score low unless their criteria are in the description.")).toBeVisible();
  await expect(page.getByText(/1 sub-task left unticked: sub-tasks are\s+steps inside a story/)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /MOB-2/ })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Import 1 story" })).toBeVisible();
});

test("a story held below Ready says why in the backlog, and points accept a decimal comma", async ({ page }) => {
  const project = await newProject(page, "Caps");
  await addStory(page, project, "Rebook my last cleaner", "13");
  await expect(page).toHaveTitle(/^STORY-1 · Story/);
  await page.goto(project);
  const row = page.getByRole("row", { name: /Rebook my last cleaner/ });
  await expect(row.getByText("Too big")).toBeVisible();

  await row.getByLabel("Points for STORY-1").fill("1,5");
  await row.getByLabel("Points for STORY-1").press("Enter");
  await expect(row.getByText("Too big")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("row", { name: /Rebook my last cleaner/ }).getByLabel("Points for STORY-1")).toHaveValue("1.5");
});

test("sprints suggest the next name and dates, show the day, and a deleted story's key isn't reused", async ({ page }) => {
  const project = await newProject(page, "Sprints");
  await addStory(page, project, "Pay with a saved card", "3");

  await page.goto(`${project}/sprints/new`);
  await expect(page.getByLabel("Name")).toHaveValue("Sprint 1");
  await page.getByLabel("Start date").fill("2026-10-01");
  await page.getByLabel("End date").fill("2099-10-14");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await expect(page.getByText(/1 Oct 2026 to 14 Oct 2099 · Day \d+ of \d+ · [\d,]+ days left/)).toBeVisible();

  await page.getByRole("checkbox", { name: /STORY-1/ }).check();
  await page.getByLabel("As of").fill("2026-10-01");
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Lock baseline" }).click();
  await expect(page.getByText("Baseline · locked")).toBeVisible();

  await page.goto(`${project}/sprints`);
  await expect(page.getByText(/Day \d+ of \d+/)).toBeVisible();
  await page.getByRole("link", { name: "New sprint" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Sprint 2");
  await expect(page.getByLabel("Start date")).toHaveValue("2099-10-15");

  // STORY-1 is in the sprint's baseline, so a new story after deleting it is STORY-2.
  await page.goto(project);
  await page.getByRole("link", { name: /Pay with a saved card/ }).click();
  await page.getByRole("button", { name: "Delete story" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete story" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await addStory(page, project, "Save a second card", "2");
  await expect(page).toHaveTitle(/^STORY-2 · Story/);
});

test("a shared report invites the viewer, and the account page counts one project properly", async ({ page, browser }) => {
  const project = await newProject(page, "Shared");
  await addStory(page, project, "Tip the cleaner", "2");
  await page.goto(`${project}/sprints/new`);
  await page.getByLabel("Start date").fill("2026-09-21");
  await page.getByLabel("End date").fill("2026-10-02");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await page.getByRole("checkbox", { name: /STORY-1/ }).check();
  await page.getByLabel("As of").fill("2026-09-21");
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Lock baseline" }).click();
  await page.getByRole("link", { name: "Open sprint report" }).click();
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create link" }).click();
  const link = await page.getByRole("dialog").getByRole("textbox").inputValue();

  const viewer = await browser.newPage();
  await viewer.goto(link);
  await expect(viewer.getByRole("complementary", { name: "About Sprintwise" })).toContainText("Made with Sprintwise.");
  await expect(viewer.getByRole("link", { name: "Try the demo" })).toBeVisible();
  await viewer.close();

  await page.goto("/account");
  await expect(page.getByText("This removes your account and your project, with its stories, sprints and snapshots.")).toBeVisible();
});
