import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test("a pasted AI draft gets a second look, without changing its score", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("AI drafts");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  const project = page.url().split("?")[0];

  // Score a story pasted straight from a chat.
  await page.goto(`${project}/stories/new`);
  await page.getByLabel("Title").fill("Refund a payment");
  await page
    .getByLabel("Description")
    .fill("Certainly! Here's a user story for refunds:\nAs a support agent I want to leverage refunds so that we reduce tickets by 30%");
  await page.getByLabel("Acceptance criteria").fill("- Refunds show on the order page\n- All edge cases are handled");
  const panel = page.getByRole("region", { name: "Worth a second look" });
  await expect(panel).toContainText("looks left over from an AI chat");
  await expect(panel).toContainText("“All edge cases are handled” would fit any story");
  await expect(panel).toContainText("“leverage” sounds busy");
  await expect(panel).toContainText("promises a measured result");
  await page.getByLabel("Story points").fill("3");
  await page.getByRole("button", { name: "Score and save" }).click();

  // The story page lists them beside the score, and says they aren't part of it.
  await expect(page.getByRole("region", { name: "Worth a second look" })).toContainText("Not part of the score.");
  await expectAccessible(page);

  // The backlog marks it and can list only those.
  await page.goto(project);
  await expect(page.getByText("Second look", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "1 worth a second look" }).click();
  await expect(page).toHaveURL(/look=1/);
  await expect(page.locator("tbody tr")).toHaveCount(1);

  // Cleaning it up clears the flag.
  await page.getByRole("link", { name: /Refund a payment/ }).click();
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Description").fill("As a support agent I want to refund a payment so that the customer gets their money back");
  await page.getByLabel("Acceptance criteria").fill("- Refunds show on the order page\n- The customer gets an email");
  await expect(page.getByRole("region", { name: "Worth a second look" })).toHaveCount(0);
});
