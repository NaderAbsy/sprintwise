import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

/** Found by an end-to-end product-owner evaluation of v2.32 (2026-11-11). */

test("the public checker scores a bug as a project does, and shows what's worth a second look", async ({ page }) => {
  await page.goto("/demo");
  const checker = page.locator("#try-it");
  const result = checker.getByRole("region", { name: "Readiness score" });
  await page.locator("#title").fill("Checkout shows a blank screen with an empty basket");
  await page.locator("#description").fill("Open checkout with nothing in the basket. The app shows a blank screen.\n\nExpected: a message that the basket is empty.");
  await page.locator("#acceptanceCriteria").fill("- An empty basket shows the message \"Your basket is empty\"");
  await page.locator("#storyPoints").fill("1");

  // Story is the default, so the story-format check applies.
  await expect(checker.getByLabel("Type")).toHaveValue("Story");
  await expect(result).toContainText('Doesn\'t follow "As a … I want … so that …"');

  // As a Bug it's scored as in the app: those checks count as passed, and the card says why.
  await checker.getByLabel("Type").selectOption("Bug");
  await expect(result).toContainText("A Bug doesn't need the");
  await expect(result).toContainText("Every check passed.");
  await expect(result).not.toContainText("Doesn't follow");

  // A pasted AI draft: the card points to "Worth a second look", and the notes are there to read.
  await checker.getByLabel("Type").selectOption("Story");
  await page.locator("#title").fill("Refund flow");
  await page
    .locator("#description")
    .fill("Certainly! Here's a user story for refunds:\n\nAs a support agent, I want to refund an order so that the customer gets their money back.");
  await page.locator("#acceptanceCriteria").fill("- Refunds can be made from the order page\n- [ADD CRITERIA HERE]");
  await expect(result).toContainText('See "Worth a second look"');
  const looks = checker.getByRole("region", { name: "Worth a second look" });
  await expect(looks).toContainText("looks left over from an AI chat");
  await expect(looks).toContainText("“[ADD CRITERIA HERE]” looks like a placeholder that was never filled in.");
  await expectAccessible(page);
});

test("weakest first lists a held-back story before the Ready ones, whatever its score", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Weakest first");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  const project = page.url().split("?")[0];
  const story = "As a support agent, I want to refund an order so that the customer gets their money back.";
  const csv = [
    "key,title,description,acceptance_criteria,story_points,status",
    `W-1,Refund an order,"${story}",- The refund shows on the order page,3,To Do`,
    `W-2,Refund flow,"Certainly! Here's a user story for refunds:\n\n${story}",- The refund shows on the order page,3,To Do`,
    "W-3,Make search faster,,,,To Do",
    `W-4,Partial refund,"${story}",- [Add criteria here],3,To Do`,
  ].join("\n");
  await page.goto(`${project}/import`);
  await page.getByLabel("CSV file").setInputFiles({ name: "backlog.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Import 4 stories" }).click();
  await expect(page.getByText("Imported and scored 4 stories.")).toBeVisible();
  await expect(page.getByText("1 of 4 stories ready")).toBeVisible();

  const keys = page.locator("tbody tr .font-mono");
  await expect(keys).toHaveText(["W-1", "W-2", "W-3", "W-4"]);
  await page.getByLabel("Order").selectOption("weakest");
  // W-3 isn't ready; W-2 (chat leftover) and W-4 (a placeholder with a capital) score 100 but are held at Needs work; W-1 is Ready.
  await expect(keys).toHaveText(["W-3", "W-2", "W-4", "W-1"]);

  // The shared backlog, which scores live, lists them in the same order.
  await page.getByRole("button", { name: "Share" }).click();
  const dialog = page.getByRole("dialog", { name: "Share this backlog" });
  await dialog.getByRole("button", { name: "Create link" }).click();
  const link = await dialog.getByLabel("Link").inputValue();
  await page.goto(`${link}?sort=weakest`);
  await expect(page.locator("main details summary .font-mono")).toHaveText(["W-3", "W-2", "W-4", "W-1"]);
});

test("the home page badge names the newest release, so it can't fall behind", async ({ page }) => {
  await page.goto("/changelog");
  const newest = (await page.getByRole("main").getByText(/^v\d+\.\d+(\.\d+)?$/).first().innerText()).trim();
  await page.goto("/");
  const badge = page.getByRole("main").getByRole("link", { name: /see what's new/ });
  await expect(badge).toContainText(newest);
  await expect(badge).toHaveAttribute("href", "/changelog");
  // One sentence in one piece: the link spaces its children apart, and once split this around the date.
  await expect(badge.locator(":scope > span").nth(1)).toHaveText(/^Updated \d{1,2} \w{3} \d{4}: see what's new$/);
  await expect(badge.locator("time")).toBeVisible();
  // On the narrowest phones it drops the date instead of wrapping, and the page still doesn't scroll sideways.
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(badge.locator("time")).toBeHidden();
  expect((await badge.boundingBox())!.height).toBeLessThan(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the home page checker scores a bug as a project does, and shows what's worth a second look", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await main.getByLabel("Story title").fill("Checkout shows a blank screen with an empty basket");
  await main.getByLabel("Description").fill("Open checkout with nothing in the basket. The app shows a blank screen.");
  await main.getByLabel(/Acceptance criteria/).fill("- An empty basket shows the message \"Your basket is empty\"");
  const result = main.locator("[aria-live=polite]").first();

  // Story by default: the story-format check fails.
  await expect(main.getByLabel("Type")).toHaveValue("Story");
  await expect(result).toContainText("1 thing to fix");
  await expect(result).toContainText("Follows story format for a named user: failed");
  await main.getByLabel("Type").selectOption("Bug");
  await expect(result).toContainText("Every check passed");
  await expect(result).toContainText("A Bug doesn't need the");

  // An example puts the type back to Story.
  await main.getByRole("button", { name: "Ready", exact: true }).click();
  await expect(main.getByLabel("Type")).toHaveValue("Story");

  // A pasted draft: held back, with the reason and the notes on the page.
  await main.getByLabel("Description").fill("Certainly! Here's a user story for refunds:\n\nAs a support agent I want to refund a payment so that the customer gets their money back");
  await expect(result).toContainText("Can't be Ready while it has text left over from an AI chat.");
  // The checker's own notes, not the sample AI draft further down the page.
  await expect(main.locator("section[aria-labelledby=hero-second-look]")).toContainText("looks left over from an AI chat");
  await expectAccessible(page);

  // Still fits a phone.
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

