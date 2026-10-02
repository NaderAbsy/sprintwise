import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

// R-6: "Saved per project; scores recalculate after saving."
test("changing the rule settings re-scores the backlog", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Settings project");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("main").getByRole("link", { name: "Score a story" }).click();
  await page.getByLabel("Title").fill("Quick invoice export");
  await page
    .getByLabel("Description")
    .fill("As a finance admin I want to export an invoice as a PDF so that I can email it to a client");
  await page.getByLabel(/Acceptance criteria/).fill("- The export button appears on every invoice\n- The PDF matches the invoice");
  await page.getByLabel("Story points").fill("5");
  await page.getByRole("button", { name: "Score and save" }).click();

  // By default "quick" is a vague word: 90, still Ready.
  const score = page.getByRole("region", { name: "Readiness score" });
  await expect(score.getByText("90 out of 100")).toBeVisible();
  await expect(score.getByText("Ready", { exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Max story points").fill("0");
  await page.getByRole("button", { name: "Save and re-score" }).click();
  await expect(page.getByText("Enter a whole number from 1 to 100.")).toBeVisible();

  // Max 3 points and a list without "quick": C5 now passes, C7 fails and caps the band.
  await page.getByLabel("Max story points").fill("3");
  await page.getByLabel("Vague words").fill("fast\neasy");
  await page.getByRole("button", { name: "Save and re-score" }).click();
  await expect(page.getByText("Saved. 1 story was re-scored with the new settings.")).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Backlog" }).click();
  const row = page.getByRole("row", { name: /Quick invoice export/ });
  await expect(row.getByText("90 out of 100")).toBeVisible();
  await expect(row.getByText("Needs work")).toBeVisible();

  // Reset brings the defaults back.
  await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Reset to defaults" }).click();
  await expect(page.getByLabel("Max story points")).toHaveValue("8");
  await expect(page.getByRole("button", { name: "Reset to defaults" })).toHaveCount(0);
});
