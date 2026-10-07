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

const keys = (page: Page) => page.locator("tbody tr .font-mono");

test("the backlog keeps a priority order you set by dragging or with the keyboard", async ({ page }) => {
  const project = await projectWithSamples(page, "Priority");
  await page.goto(project);
  await expect(keys(page).first()).toHaveText("TIDY-101");

  // Keyboard: focus a handle, Home sends it to the top.
  const handle = page.getByRole("button", { name: /^Move TIDY-112, priority 12 of 12/ });
  await handle.focus();
  await page.keyboard.press("Home");
  await expect(keys(page).first()).toHaveText("TIDY-112");
  await expect(page.getByRole("button", { name: /^Move TIDY-112, priority 1 of 12/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(keys(page).nth(1)).toHaveText("TIDY-112");

  // Mouse: drag TIDY-109 by its handle onto the first row, moving in steps as a person would.
  await page.locator("table").evaluate((table) => table.scrollIntoView({ block: "start" }));
  const from = (await page.getByRole("button", { name: /^Move TIDY-109/ }).boundingBox())!;
  const to = (await page.locator("tbody tr").first().boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 300, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(keys(page).first()).toHaveText("TIDY-109");

  // The order is saved, and the export and the sprint picker use it.
  await expect(page.getByText("Order saved.")).toBeVisible();
  await page.reload();
  await expect(keys(page)).toHaveText([
    "TIDY-109",
    "TIDY-101",
    "TIDY-112",
    "TIDY-102",
    "TIDY-103",
    "TIDY-104",
    "TIDY-105",
    "TIDY-106",
    "TIDY-107",
    "TIDY-108",
    "TIDY-110",
    "TIDY-111",
  ]);
  const csv = await (await page.request.get(`${project}/export.csv`)).text();
  expect(csv.split("\r\n")[1]).toMatch(/^TIDY-109,/);
  await page.goto(`${project}/sprints/new`);
  await page.getByLabel("Name").fill("Sprint 1");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await expect(page.getByRole("checkbox", { name: /TIDY-/ }).first()).toHaveAccessibleName(/TIDY-109/);

  // Weakest first is still one click away, and can't be dragged.
  await page.goto(`${project}?sort=weakest`);
  await expect(keys(page).first()).toHaveText("TIDY-105");
  await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);
  await expectAccessible(page);
});

test("search, filter by status, and change several stories at once", async ({ page }) => {
  const project = await projectWithSamples(page, "Bulk");

  await page.getByLabel("Search").fill("cleaner");
  await page.getByLabel("Search").press("Enter");
  await expect(page.getByText("Showing 5 of 12 stories.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);

  // Tick two and set their status.
  await page.getByRole("checkbox", { name: "Select TIDY-104" }).check();
  await page.getByRole("checkbox", { name: "Select TIDY-107" }).check();
  const bar = page.getByRole("region", { name: "Change selected stories" });
  await expect(bar).toContainText("2 stories selected");
  await bar.getByLabel("New status for the selected stories").fill("Refining");
  await bar.getByRole("button", { name: "Set status" }).click();
  await expect(bar.getByText("Set 2 stories to Refining.")).toBeVisible();
  await expectAccessible(page);

  // Filter by the new status, then delete them both.
  await page.goto(project);
  await page.getByLabel("Status", { exact: true }).selectOption("Refining");
  await expect(keys(page)).toHaveText(["TIDY-104", "TIDY-107"]);
  await page.getByRole("checkbox", { name: "Select all stories shown" }).check();
  await page.getByRole("region", { name: "Change selected stories" }).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog", { name: "Delete 2 stories?" }).getByRole("button", { name: "Delete stories" }).click();
  await expect(page.getByText("No stories match.")).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByText("5 of 10 stories ready", { exact: false })).toBeVisible();
});

test("Next to fix walks the stories that aren't Ready, weakest first", async ({ page }) => {
  const project = await projectWithSamples(page, "Fix next");
  await page.goto(`${project}?sort=weakest`);
  await page.getByRole("link", { name: /TIDY-105/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("TIDY-105");
  await page.getByRole("link", { name: "Next to fix: TIDY-103" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("TIDY-103");
  await page.getByRole("link", { name: "Next to fix: TIDY-110" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("TIDY-110");
});

test("a story's status is picked from a list of the usual and the project's own statuses", async ({ page }) => {
  await projectWithSamples(page, "Status list");
  const status = page.getByLabel("Status of TIDY-104", { exact: true });
  await expect(status).toHaveJSProperty("tagName", "SELECT");
  const options = await status.locator("option").allTextContents();
  expect(options.slice(0, 2)).toEqual(["To Do", "In Progress"]);
  expect(options).toContain("Done");
  await status.selectOption("In Progress");
  await expect(page.getByLabel("Status of TIDY-104 saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Status of TIDY-104", { exact: true })).toHaveValue("In Progress");
  await expectAccessible(page);
});
