import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

// Runs against the pretend Jira (JIRA_FAKE), which holds four invented issues, SHOP-1 to SHOP-4.
test("import from Jira, send an edit back, and sync without losing work done here", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Jira project");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  const project = page.url().split("?")[0];

  // Import: pick the site, keep the suggested search, preview, import.
  await page.goto(`${project}/import`);
  const jira = page.getByRole("region", { name: "From Jira" });
  await expect(jira.getByLabel("Jira site")).toHaveValue("fake-cloud-id");
  await expect(jira.getByLabel("Search (JQL)")).toHaveValue(/statusCategory != Done/);
  await expectAccessible(page);
  await jira.getByRole("button", { name: "Preview issues" }).click();
  await expect(page.getByText("3 issues from Jira.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "3 stories in the file" })).toBeVisible();
  await page.getByRole("button", { name: "Import 3 stories" }).click();
  await expect(page.getByText("Imported and scored 3 stories.")).toBeVisible();
  await expect(page.getByText(/From Example Jira, last synced/)).toBeVisible();
  await expect(page.getByRole("table").getByText("Bug", { exact: true })).toBeVisible();

  // Edit SHOP-3 and send it to Jira from the story page.
  const description = `As an accountant I want to export statements so that I can file taxes (${Date.now()})`;
  await page.getByRole("link", { name: /SHOP-3/ }).click();
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Description").fill(description);
  await page.getByRole("button", { name: "Save changes" }).click();
  const panel = page.getByRole("region", { name: /Edited here, not yet in Jira/ });
  await panel.getByRole("button", { name: "Send to Jira" }).click();
  await expect(panel).toHaveCount(0);

  // Edit SHOP-1 but don't send it; Sync updates the rest and leaves it alone.
  await page.goto(project);
  await page.getByRole("link", { name: /SHOP-1/ }).click();
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Title").fill("Refund a payment in full or in part");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.goto(project);
  await page.getByRole("button", { name: "Sync from Jira" }).click();
  await expect(page.getByText("Synced from Jira: 2 updated, 0 added. 1 edited here was left as it is; send it to Jira first.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Refund a payment in full or in part/ })).toBeVisible();

  // The sent description came back from Jira.
  await page.getByRole("link", { name: /SHOP-3/ }).click();
  await expect(page.getByRole("region", { name: "The story" })).toContainText(description);

  // Send the remaining edit from the backlog.
  await page.goto(project);
  await page.getByRole("button", { name: "Send 1 to Jira" }).click();
  await expect(page.getByText("Sent 1 to Jira: SHOP-1.")).toBeVisible();
});
