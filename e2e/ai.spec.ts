import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

// The test server runs with AI_FAKE_RESPONSES, so no real Claude API call is made.
test("R-4 and R-5: a weak story gets an AI rewrite and test scenarios", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("AI project");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("link", { name: "Score a story" }).click();
  await page.getByLabel("Title").fill("Book a cleaner");
  await page.getByLabel(/Acceptance criteria/).fill("- Only free slots are shown\n- A confirmation email is sent");
  await page.getByLabel("Story points").fill("3");
  await page.getByRole("button", { name: "Score and save" }).click();

  const panel = page.getByRole("region", { name: /Rewrite and test scenarios/ });
  // F-5: the notice is shown before the first AI call.
  await expect(panel.getByText(/Sends this story's title, description and criteria to the Claude API/)).toBeVisible();
  await panel.getByRole("button", { name: "Suggest a rewrite" }).click();

  await expect(panel.getByRole("heading", { name: "Suggested rewrite" })).toBeVisible();
  await expect(panel.getByText(/As a customer, I want book a cleaner/)).toBeVisible();
  // One scenario per criterion, in Given / When / Then form.
  await expect(panel.getByRole("listitem").filter({ hasText: "Given" })).toHaveCount(2);
  // The rewrite is scored by the same rules, shown beside the original.
  await expect(panel.getByText("Rules score:")).toBeVisible();

  await panel.getByRole("button", { name: "Copy scenarios" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Scenario: Only free slots are shown");
  await expectAccessible(page);

  // The original story is unchanged, and the suggestion is kept after a reload.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: /Book a cleaner/ })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Suggest again" })).toBeVisible();
});

test("a Ready story isn't offered a rewrite", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Ready project");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("link", { name: "Score a story" }).click();
  await page.getByLabel("Title").fill("Export invoices as PDF");
  await page
    .getByLabel("Description")
    .fill("As a finance admin I want to export an invoice as a PDF so that I can email it to a client");
  await page.getByLabel(/Acceptance criteria/).fill("- The export button appears on every invoice\n- The PDF matches the invoice");
  await page.getByLabel("Story points").fill("3");
  await page.getByRole("button", { name: "Score and save" }).click();
  const panel = page.getByRole("region", { name: /Rewrite and test scenarios/ });
  await expect(panel.getByText("This story is Ready, so it doesn't need a rewrite.")).toBeVisible();
  await expect(panel.getByRole("button")).toHaveCount(0);
});
