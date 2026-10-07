import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

async function projectWith(page: Page, name: string, csv: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  const project = page.url().split("?")[0];
  await page.goto(`${project}/import`);
  await page.getByLabel("CSV file").setInputFiles({ name: "jira.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  return project;
}

const CSV = [
  "Issue key,Summary,Issue Type,Description,Acceptance Criteria,Story Points,Status",
  'PAY-1,Refund a payment,Story,"As a support agent I want to refund a payment so that the customer gets their money back","- Full and partial refunds\n- The customer gets an email",3,To Do',
  'PAY-2,Refund total ignores the discount,Bug,"The refund page adds the discount back before refunding.","- Refunds subtract the discount\n- The refund email shows the same total",2,To Do',
  "PAY-3,Old checkout clean-up,Task,,,1,Done",
].join("\n");

test("finished stories stay out of the readiness counts until asked for", async ({ page }) => {
  const project = await projectWith(page, "Finished", CSV);
  // Done stories start unticked; tick it to bring it in anyway.
  await page.getByRole("checkbox", { name: "Import PAY-3" }).check();
  await page.getByRole("button", { name: "Import 3 stories" }).click();
  await expect(page.getByText("Imported and scored 3 stories.")).toBeVisible();

  await expect(page.getByText("2 of 2 stories ready (1 finished not counted)", { exact: false })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("link", { name: "Show 1 finished" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("link", { name: "Hide 1 finished" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);

  await page.goto("/projects");
  await expect(page.getByText("2 of 2 stories ready")).toBeVisible();
  await page.goto(project);
  await expectAccessible(page);
});

test("a bug isn't asked for the user-story format, and the backlog can filter by type", async ({ page }) => {
  await projectWith(page, "Types", CSV);
  await expect(page.getByLabel("Type", { exact: true }).locator("option")).toHaveText(["All", "Bug", "Story", "Task"]);
  await page.getByRole("button", { name: "Import 2 stories" }).click();
  await expect(page.getByText("Imported and scored 2 stories.")).toBeVisible();

  await page.getByLabel("Type", { exact: true }).selectOption("Bug");
  await expect(page).toHaveURL(/type=Bug/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: /PAY-2/ }).click();
  await expect(page.getByText("A Bug doesn't need the \"As a … I want … so that …\" format", { exact: false })).toBeVisible();
  await expect(page.getByText("Every check passed.")).toBeVisible();
});

test("edits made here are listed for Jira, can be copied and marked done, and aren't overwritten by a re-import", async ({ page }) => {
  const project = await projectWith(page, "Back to Jira", CSV);
  await page.getByRole("button", { name: "Import 2 stories" }).click();
  await expect(page.getByText("Imported and scored 2 stories.")).toBeVisible();

  // Edit PAY-1's criteria.
  await page.getByRole("link", { name: /PAY-1/ }).click();
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Acceptance criteria").fill("- Full and partial refunds\n- The customer gets an email\n- The refund shows on the order page");
  await page.getByRole("button", { name: "Save changes" }).click();
  const panel = page.getByRole("region", { name: /Edited here, not yet in Jira/ });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Copy acceptance criteria" })).toBeVisible();
  await expectAccessible(page);

  // A status change alone isn't a Jira edit; the backlog lists the edited story.
  await page.goto(project);
  await expect(page.getByText("Edited here").first()).toBeVisible();
  await page.getByRole("link", { name: "1 edited here, not yet in Jira" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const csv = await (await page.request.get(`${project}/jira.csv`)).text();
  expect(csv.split("\r\n")[0]).toBe("﻿Issue key,Summary,Issue Type,Description,Acceptance Criteria,Story Points");
  expect(csv).toContain("The refund shows on the order page");
  expect(csv).not.toContain("PAY-2");

  // Re-importing the old Jira file leaves the edited story unticked.
  await page.goto(`${project}/import`);
  await page.getByLabel("CSV file").setInputFiles({ name: "jira.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
  await expect(page.getByText("1 story you edited in Sprintwise and haven't marked as copied to Jira left unticked", { exact: false })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Import PAY-1" })).not.toBeChecked();

  // Once copied, it leaves the list.
  await page.goto(project);
  await page.getByRole("link", { name: /PAY-1/ }).click();
  await page.getByRole("button", { name: "Mark as copied to Jira" }).click();
  await expect(panel).toHaveCount(0);
  await page.goto(project);
  await expect(page.getByRole("link", { name: /edited here, not yet in Jira/ })).toHaveCount(0);
});
