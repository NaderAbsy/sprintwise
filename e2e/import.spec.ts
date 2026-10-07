import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

/** An invented Jira-style export: an unfamiliar key column, an epic per story and repeated Labels columns. */
function jiraExport(rows: number) {
  const epics = ["Checkout", "Search", "Profiles"];
  const lines = Array.from({ length: rows }, (_, i) => {
    const n = i + 1;
    const epic = epics[i % 3];
    const label = i % 2 === 0 ? "web" : "mobile";
    return `DEMO-${n},"As a shopper I want item ${n} so that I can buy it","- It shows item ${n}",${(i % 5) + 1},To Do,${epic},${label},team-a`;
  });
  return ["Ticket,Summary,Acceptance Criteria,Story Points,Status,Parent summary,Labels,Labels", ...lines].join("\n");
}

async function openImport(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  const project = page.url().split("?")[0];
  await page.goto(`${project}/import`);
  return project;
}

test("a big Jira export: match the key column, pick one epic, import it, and the choice is remembered", async ({ page }) => {
  const project = await openImport(page, "Big export");
  await page.getByLabel("CSV file").setInputFiles({ name: "Jira.csv", mimeType: "text/csv", buffer: Buffer.from(jiraExport(318)) });

  // "Ticket" isn't a name Sprintwise knows, so the column matcher opens.
  await expect(page.getByText("Missing required column: key.")).toBeVisible();
  await expectAccessible(page);
  await page.getByLabel("Key column (required)").selectOption("Ticket");
  await expect(page.getByRole("heading", { name: "318 stories in the file" })).toBeVisible();
  await expect(page.getByText("318 stories ticked", { exact: false })).toBeVisible();

  // Only one epic.
  await page.getByLabel("Epic", { exact: true }).selectOption("Search");
  await expect(page.getByText("Showing 106 of 318.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Tick only these 106" }).click();
  await expect(page.getByText("106 stories ticked", { exact: false })).toBeVisible();
  await page.getByLabel("Label", { exact: true }).selectOption("mobile");
  await page.getByRole("checkbox", { name: "Tick all stories shown" }).uncheck();
  await expect(page.getByText("53 stories ticked", { exact: false })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Import 53 stories" }).click();
  await expect(page.getByText("Imported and scored 53 stories.")).toBeVisible();

  // The backlog shows the epic and can filter by it.
  await expect(page.getByRole("main").getByText("Search").first()).toBeVisible();
  await page.getByLabel("Epic", { exact: true }).selectOption("Search");
  await expect(page).toHaveURL(/epic=Search/);
  await expect(page.locator("tbody tr")).toHaveCount(53);
  await expect(page.getByLabel("Epic", { exact: true }).locator("option")).toHaveText(["Any epic", "Search"]);

  // Next time, the same columns are picked straight away.
  await page.goto(`${project}/import`);
  await page.getByLabel("CSV file").setInputFiles({ name: "Jira.csv", mimeType: "text/csv", buffer: Buffer.from(jiraExport(5)) });
  await expect(page.getByRole("heading", { name: "5 stories in the file" })).toBeVisible();
  await expect(page.getByText("Key ← Ticket", { exact: false })).toBeVisible();
});

test("more stories than one import takes: nothing is pre-ticked, and the limit is explained", async ({ page }) => {
  await openImport(page, "Too many");
  const csv = jiraExport(600).replace(/^Ticket/, "Issue key");
  await page.getByLabel("CSV file").setInputFiles({ name: "Jira.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("heading", { name: "600 stories in the file" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tick stories to import" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Tick all stories" }).check();
  await expect(page.getByText("Up to 500 stories go in one import. Untick 100", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import 600 stories" })).toBeDisabled();
  await page.getByLabel("Epic", { exact: true }).selectOption("Checkout");
  await page.getByRole("button", { name: "Tick only these 200" }).click();
  await expect(page.getByRole("button", { name: "Import 200 stories" })).toBeEnabled();
});

test("rows with problems are shown but can't be ticked; the rest import", async ({ page }) => {
  await openImport(page, "Some bad rows");
  const csv = "key,title,story_points\nA-1,Good one,3\nA-2,,2\nA-1,Duplicate,1\nA-3,Also good,2";
  await page.getByLabel("CSV file").setInputFiles({ name: "mixed.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("heading", { name: "4 stories in the file · 2 can't be imported" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Import A-2" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Import A-2" })).toHaveAccessibleDescription("Row 2: The title is empty.");
  await expect(page.getByText(/Row 3: Duplicate key A-1/)).toBeVisible();
  await page.getByRole("button", { name: "Import 2 stories" }).click();
  await expect(page.getByText("Imported and scored 2 stories.")).toBeVisible();
});
