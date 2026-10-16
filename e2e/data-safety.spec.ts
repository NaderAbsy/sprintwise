import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/** Found by the full code review (2026-10-16): imports and Jira must never quietly lose anyone's text. */

async function newProject(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  return page.url().split("?")[0];
}

/** A teammate's change in the pretend Jira. */
async function inJira(page: Page, key: string, change: Record<string, unknown>) {
  const response = await page.request.post("/api/test/jira", { data: { key, change } });
  expect(response.ok()).toBe(true);
}

async function editStory(page: Page, project: string, key: string, fields: Record<string, string>) {
  await page.goto(project);
  await page.getByRole("link", { name: new RegExp(key) }).first().click();
  await page.getByRole("link", { name: "Edit story" }).click();
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("link", { name: "Edit story" })).toBeVisible();
}

test("re-importing a file with fewer columns keeps the text already saved", async ({ page }) => {
  const project = await newProject(page, "Fewer columns");
  await page.goto(`${project}/import`);
  const full = [
    "key,title,description,acceptance_criteria,story_points,status",
    'PAY-1,Refund a payment,"As an agent I want to refund a payment so that the customer is paid back.","- Full refunds\n- Partial refunds",3,To Do',
  ].join("\n");
  await page.getByLabel("CSV file").setInputFiles({ name: "full.csv", mimeType: "text/csv", buffer: Buffer.from(full) });
  await page.getByRole("button", { name: "Import 1 story" }).click();
  await expect(page.getByText("Imported and scored 1 story.")).toBeVisible();

  // Jira's "current fields" export: only key, summary and status.
  await page.goto(`${project}/import`);
  const thin = ["Issue key,Summary,Status", "PAY-1,Refund a card payment,In Progress"].join("\n");
  await page.getByLabel("CSV file").setInputFiles({ name: "thin.csv", mimeType: "text/csv", buffer: Buffer.from(thin) });
  await expect(page.getByText(/Stories already in Sprintwise keep their saved description and acceptance criteria/)).toBeVisible();
  await page.getByRole("button", { name: "Import 1 story" }).click();
  await expect(page.getByText("Imported and scored 1 story.")).toBeVisible();

  await page.getByRole("link", { name: /PAY-1/ }).first().click();
  const story = page.getByRole("region", { name: "The story" });
  await expect(page.getByRole("heading", { name: "Refund a card payment" })).toBeVisible();
  await expect(story).toContainText("so that the customer is paid back");
  await expect(story).toContainText("Partial refunds");
  await expect(page.locator("dt:text-is('Points') + dd")).toHaveText("3");
});

test("Jira: finished issues sync, left-out ones stay out, and Send never overwrites a teammate's change", async ({ page }) => {
  const project = await newProject(page, "Jira safety");
  await page.goto(`${project}/import`);
  const jira = page.getByRole("region", { name: "From Jira" });
  await jira.getByRole("button", { name: "Preview issues" }).click();
  await expect(page.getByText("3 issues from Jira.")).toBeVisible();
  // SHOP-2 is left out on purpose.
  await page.getByRole("checkbox", { name: "Import SHOP-2" }).uncheck();
  await page.getByRole("button", { name: "Import 2 stories" }).click();
  await expect(page.getByText("Imported and scored 2 stories.")).toBeVisible();

  // SHOP-3 is finished in Jira: the suggested search no longer finds it, but Sync still brings the news.
  await inJira(page, "SHOP-3", { status: "Done" });
  await page.getByRole("button", { name: "Sync from Jira" }).click();
  await expect(page.getByText(/Synced from Jira: 2 updated, 0 added\./)).toBeVisible();
  await expect(page.getByText(/1 left out at import or deleted here wasn't added/)).toBeVisible();
  await page.goto(`${project}?finished=show`);
  await expect(page.getByLabel("Status of SHOP-3", { exact: true })).toHaveValue("Done");
  await expect(page.getByRole("link", { name: /SHOP-2/ })).toHaveCount(0);

  // Points edited here; meanwhile a teammate rewrites the description in Jira. Send writes only the points.
  await editStory(page, project, "SHOP-1", { "Story points": "5" });
  const rewritten = "As a support agent I want to refund part of a payment so that a returned item is paid back.";
  await inJira(page, "SHOP-1", { description: rewritten });
  await page.goto(project);
  await page.getByRole("button", { name: "Send 1 to Jira" }).click();
  await expect(page.getByText("Sent 1 to Jira: SHOP-1.")).toBeVisible();
  await page.getByRole("button", { name: "Sync from Jira" }).click();
  await expect(page.getByText(/Synced from Jira/)).toBeVisible();
  await page.getByRole("link", { name: /SHOP-1/ }).first().click();
  await expect(page.getByRole("region", { name: "The story" })).toContainText(rewritten);
  await expect(page.locator("dt:text-is('Points') + dd")).toHaveText("5");

  // The same field changed in both places is held back, and Sync keeps the edit while taking Jira's status.
  await editStory(page, project, "SHOP-1", { Title: "Refund a payment, edited here" });
  await inJira(page, "SHOP-1", { summary: "Refund a payment, edited in Jira", status: "In Progress" });
  await page.goto(project);
  await page.getByRole("button", { name: "Send 1 to Jira" }).click();
  await expect(page.getByText(/SHOP-1: the title also changed in Jira/)).toBeVisible();
  await page.getByRole("button", { name: "Sync from Jira" }).click();
  await expect(page.getByText(/1 edited here kept its edits/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Refund a payment, edited here/ })).toBeVisible();
  await expect(page.getByLabel("Status of SHOP-1", { exact: true })).toHaveValue("In Progress");
});
