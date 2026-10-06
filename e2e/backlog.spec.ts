import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

const CSV = [
  "Issue key,Summary,Description,Acceptance Criteria,Story Points,Status",
  'PAY-1,Refund a payment,"As an agent I want to refund a payment so that the customer gets their money back","- Full and partial refunds\n- The customer gets an email",3,To Do',
  "PAY-2,Fast and easy reports,,,,To Do",
  'PAY-3,Export statements,"As a customer I want to export statements so that I can file taxes","- CSV and PDF formats",XL,To Do',
].join("\n");

test("a PO creates a project, scores a story and imports a backlog", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await expectAccessible(page);

  // F-4: create a project; the name is required.
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText("Give the project a name.")).toBeVisible();
  await page.getByLabel("Name").fill("Payments team");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Backlog" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Payments team" })).toBeVisible(); // in the sidebar
  await expectAccessible(page);

  // R-1: paste one story; empty input shows an error, then a score with reasons.
  await page.getByRole("link", { name: "Score a story" }).click();
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByText("Paste a story title to score.")).toBeVisible();
  await page.getByLabel("Title").fill("Make checkout fast");
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "STORY-1 Make checkout fast" })).toBeVisible();
  const score = page.getByRole("region", { name: "Readiness score" });
  await expect(score.getByText("5 out of 100")).toBeVisible();
  await expect(score.getByText("Not ready")).toBeVisible();
  await expect(page.getByText('The story uses vague words: "fast".')).toBeVisible();
  await expectAccessible(page);

  // R-2: import a Jira-style CSV with a preview first.
  await page.getByRole("link", { name: "Backlog" }).first().click();
  await page.getByRole("link", { name: "Import CSV" }).click();
  await page.getByLabel("CSV file").setInputFiles({ name: "backlog.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
  await expect(page.getByText("Preview: 1 of 3 stories ready")).toBeVisible();
  await expect(page.getByText(/Row 3: Story points "XL"/)).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Import 3 stories" }).click();

  // Priority order is the order stories arrived; R-3: "weakest first" puts the lowest score first.
  await expect(page.getByText("Imported and scored 3 stories.")).toBeVisible();
  await expect(page.getByText("1 of 4 stories ready")).toBeVisible();
  const keys = page.locator("tbody tr .font-mono");
  await expect(keys).toHaveText(["STORY-1", "PAY-1", "PAY-2", "PAY-3"]);
  await page.getByLabel("Order").selectOption("weakest");
  // PAY-2 and STORY-1 tie on score, so priority breaks the tie.
  await expect(keys).toHaveText(["STORY-1", "PAY-2", "PAY-3", "PAY-1"]);
  // PAY-3 scores 80 but has no estimate, so it's capped at Needs work.
  await page.getByRole("link", { name: "Ready 1", exact: true }).click();
  await expect(keys).toHaveText(["PAY-1"]);

  // F-4: delete asks for confirmation and removes the project.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Delete project" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("main").getByText("No projects yet.")).toBeVisible();
});

test("a CSV with a missing column is rejected with the column named, and can be removed", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Bad CSV");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("link", { name: "Import CSV" }).click();
  await page.getByLabel("CSV file").setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("key,points\nA-1,3") });
  await expect(page.getByText("Missing required column: title.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Import/ })).toHaveCount(0);

  // Remove clears the file and its errors, ready for another.
  await page.getByRole("button", { name: "Remove bad.csv" }).click();
  await expect(page.getByText("Missing required column: title.")).toHaveCount(0);
  await expect(page.getByLabel("CSV file")).toBeFocused();
  await expect(page.getByLabel("CSV file")).toHaveValue("");
  await expect(page.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
});

test("users only see their own projects", async ({ browser }) => {
  const owner = await browser.newPage();
  await signIn(owner);
  await owner.goto("/projects");
  await owner.getByLabel("Name").fill("Private project");
  await owner.getByRole("button", { name: "Create project" }).click();
  await expect(owner.getByRole("link", { name: "Private project" })).toBeVisible();
  const url = owner.url();

  const other = await browser.newPage();
  await signIn(other);
  const response = await other.goto(url);
  expect(response?.status()).toBe(404);
});
