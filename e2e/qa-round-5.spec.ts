import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

/** Found by a fifth round (2026-11-10): a brand-new account bringing its own Jira export, also on a phone. */

async function newProject(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  return page.url().split("?")[0];
}

async function upload(page: Page, project: string, file: string | Buffer) {
  await page.goto(`${project}/import`);
  await page.getByLabel("CSV file").setInputFiles({ name: "Jira.csv", mimeType: "text/csv", buffer: Buffer.from(file) });
}

/** An invented export from a Jira site with both kinds of project: each fills a different points column. */
const twoPointColumns = [
  "Summary,Issue key,Issue Type,Status,Description,Custom field (Story Points),Custom field (Story point estimate)",
  'Reschedule a booking,TIDY-201,Story,To Do,"As a customer, I want to move my booking so that I don\'t have to rebook.\n\nACs:\n* The customer can pick any free slot\n* The cleaner is told the new time",3.0,',
  'Cleaner sees today\'s jobs,TIDY-202,Story,To Do,"As a cleaner I want a list of today\'s jobs so that I can plan my route.\n\nAC:\nScenario 1:\nGiven I have three jobs today\nWhen I open the app\nThen I see them ordered by start time",,5',
  "Bookings,TIDY-200,Epic,To Do,Everything about booking a cleaner.,,",
].join("\n");

test("a Jira export with two points columns, and criteria under 'ACs:' or a scenario label, scores as written", async ({ page }) => {
  const project = await newProject(page, "Two columns");
  await upload(page, project, twoPointColumns);
  const rows = page.getByRole("table", { name: "Stories in the file. Tick the ones to import." }).locator("tbody tr");
  // Each story's points come from whichever column holds them, and both stories' criteria are found.
  await expect(rows.filter({ hasText: "TIDY-201" })).toContainText(/3\s*100\s*Ready/);
  await expect(rows.filter({ hasText: "TIDY-202" })).toContainText(/5\s*100\s*Ready/);
  await expect(page.getByText(/No Story points column/)).toHaveCount(0);

  // An epic someone ticks anyway reads "An Epic", not "A Epic".
  await page.getByRole("checkbox", { name: /TIDY-200/ }).check();
  await page.getByRole("button", { name: "Import 3 stories" }).click();
  await page.getByRole("link", { name: /TIDY-200/ }).first().click();
  await expect(page.getByRole("region", { name: "Readiness score" })).toContainText("An Epic doesn't need");
});

test("a file with no points column says so, and a too-long description is cut short instead of refused", async ({ page }) => {
  const project = await newProject(page, "Long and unestimated");
  const long = `${"As a shopper I want a thing so that I am happy. ".repeat(110)}\n\nAC:\n- Kept for 30 days`;
  await upload(page, project, `Issue key,Summary,Description,Custom field (Estimate)\nTIDY-701,Long one,"${long}",2\n`);
  await expect(page.getByText("No Story points column, so every new story counts as not estimated and can't be Ready.")).toBeVisible();
  await expect(page.getByText(/The description is longer than 5,000 characters, so it's cut short here\. Its acceptance criteria are kept/)).toBeVisible();
  await page.getByRole("button", { name: "Import 1 story" }).click();
  await expect(page.getByText("Imported and scored 1 story.")).toBeVisible();
  await page.getByRole("link", { name: /TIDY-701/ }).first().click();
  await expect(page.getByRole("main")).toContainText("cut short here; the full text is in your file");
  await expect(page.getByRole("main")).toContainText("Kept for 30 days");
});

test("a CSV saved by Excel on Windows keeps its accents and dashes", async ({ page }) => {
  const project = await newProject(page, "Excel");
  // "Café booking – it’s on" in the Western European code page: é = E9, en dash = 96, apostrophe = 92.
  const bytes = Buffer.from([...Buffer.from("Issue key,Summary\nTIDY-721,Caf"), 0xe9, ...Buffer.from(" booking "), 0x96, ...Buffer.from(" it"), 0x92, ...Buffer.from("s on\n")]);
  await upload(page, project, bytes);
  await expect(page.getByText("Café booking – it’s on")).toBeVisible();
});

test("on a phone, backlog titles keep their width, and stories can be moved and updated", async ({ page }) => {
  const project = await newProject(page, "Phone");
  await upload(page, project, twoPointColumns);
  await page.getByRole("button", { name: "Import 2 stories" }).click();
  await expect(page.getByText("Imported and scored 2 stories.")).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(project);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  // The title used to get about 55px and break mid-word; it now has most of the row.
  const title = await page.getByRole("link", { name: /TIDY-201/ }).boundingBox();
  expect(title!.width).toBeGreaterThan(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Points show under the title, since their column is hidden.
  await expect(rows.first()).toContainText("Ready · 3 pts");
  // Laid out as blocks, it's still read out as a table.
  await expect(page.getByRole("table", { name: /^Stories/ }).getByRole("row")).toHaveCount(3);
  await expectAccessible(page);

  // No drag handle on a phone: the arrows move a story one step, and the order is saved.
  await expect(page.getByRole("button", { name: "Move TIDY-201 up" })).toBeDisabled();
  await page.getByRole("button", { name: "Move TIDY-201 down" }).click();
  await expect(page.getByText("Order saved.")).toBeVisible();
  await page.reload();
  await expect(rows.first()).toContainText("TIDY-202");
  await expect(rows.last()).toContainText("TIDY-201");

  await page.getByLabel("Status of TIDY-201").selectOption("In Progress");
  await expect(page.getByLabel("Status of TIDY-201")).toHaveValue("In Progress");

  // The import preview says what a score means on a phone too.
  await upload(page, project, twoPointColumns);
  const preview = page.getByRole("table", { name: "Stories in the file. Tick the ones to import." });
  await expect(preview.locator("tbody tr").filter({ hasText: "TIDY-200" }).getByText("Not ready")).toBeVisible();
});

test("an empty backlog's new-sprint page links to where stories come from", async ({ page }) => {
  const project = await newProject(page, "No stories yet");
  await page.goto(`${project}/sprints`);
  await page.getByRole("link", { name: "New sprint" }).click();
  await page.getByLabel("Name").fill("Sprint 1");
  await page.getByLabel("Start date").fill("2026-11-02");
  await page.getByLabel("End date").fill("2026-11-13");
  await page.getByRole("button", { name: "Create sprint" }).click();
  // With nothing in the backlog the page opens on "Upload a CSV"; picking the backlog says where stories come from.
  await page.getByText("From the backlog", { exact: true }).click();
  await expect(page.getByText("This project's backlog is empty.")).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Import stories" }).click();
  await expect(page).toHaveURL(/\/import$/);
  // And the import page says how to get a file out of Jira.
  await expect(page.getByText(/To get a file from Jira:/)).toBeVisible();
});
