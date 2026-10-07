import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

const DESCRIPTION = [
  "h3. The scenario",
  "",
  "A shopper pays with a *saved card* and gets a receipt.",
  "",
  "* *Step 1* choose the card",
  "* *Step 2* confirm with {{one tap}}",
  "",
  "h3. What we sent",
  "{noformat}amount   = 40.00",
  "currency = EUR{noformat}",
  ...Array.from({ length: 12 }, (_, i) => `Note line ${i + 1} about the payment.`),
].join("\n");

test("Jira's formatting shows as Jira shows it, and the edit page lines the two versions up", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Formatting");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  const project = page.url().split("?")[0];
  await page.goto(`${project}/import`);
  const csv = `Issue key,Summary,Description,Status\nPAY-9,Pay with a saved card,"${DESCRIPTION.replace(/"/g, '""')}",To Do`;
  await page.getByLabel("CSV file").setInputFiles({ name: "jira.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Import 1 story" }).click();
  await expect(page.getByText("Imported and scored 1 story.")).toBeVisible();

  // Story page: headings, bold, code and the preformatted block, with no markup symbols left.
  await page.getByRole("link", { name: /PAY-9/ }).click();
  const story = page.getByRole("region", { name: "The story" });
  await expect(story.getByRole("heading", { name: "The scenario" })).toBeVisible();
  await expect(story.locator("strong", { hasText: "saved card" })).toBeVisible();
  await expect(story.locator("code", { hasText: "one tap" })).toBeVisible();
  await expect(story.locator("pre")).toHaveText("amount   = 40.00\ncurrency = EUR");
  await expect(story).not.toContainText("h3.");
  await expect(story).not.toContainText("{noformat}");
  await expectAccessible(page);

  // Edit page: Before is formatted, with the raw text one click away; the new version grows to fit.
  await page.getByRole("link", { name: "Edit story" }).click();
  const before = page.locator("#description-before");
  await expect(before.getByRole("heading", { name: "The scenario" })).toBeVisible();
  await page.getByRole("button", { name: "Show as typed" }).first().click();
  await expect(before).toContainText("h3. The scenario");
  const fits = await page.getByLabel("Description").evaluate((el: HTMLTextAreaElement) => el.scrollHeight <= el.clientHeight + 2);
  expect(fits).toBe(true);
  await page.getByLabel("Description").press("End");
  await page.getByLabel("Description").pressSequentially("\nOne more line.\nAnd another.");
  const stillFits = await page.getByLabel("Description").evaluate((el: HTMLTextAreaElement) => el.scrollHeight <= el.clientHeight + 2);
  expect(stillFits).toBe(true);
  await expectAccessible(page);
});
