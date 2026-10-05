import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test("rules v3: a story with the right shape but vague content isn't Ready, with one reason per thing to fix", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Scoring");
  await page.getByRole("button", { name: "Create project" }).click();

  await page.getByRole("link", { name: "Score a story" }).first().click();
  const live = page.getByRole("complementary", { name: "Live score" });
  await page.getByLabel("Title").fill("As a user I want a dashboard so that I can see stuff");
  await page.getByLabel(/Acceptance criteria/).fill("Given I log in When I open the dashboard Then it works");
  await page.getByLabel("Story points").fill("3");
  await expect(live.getByText("Needs work")).toBeVisible();
  await expect(live.getByText(/"As a user" could be anyone/)).toBeVisible();
  await expect(live.getByText(/can't be tested: "works"/)).toBeVisible();

  // Fixing what it says makes it Ready.
  await page.getByLabel("Title").fill("Failed payments dashboard");
  await page
    .getByLabel("Description")
    .fill("As a support agent I want a list of today's failed payments so that I can call those customers back");
  await page
    .getByLabel(/Acceptance criteria/)
    .fill("- Shows every payment that failed since midnight\n- Each row has the customer's phone number");
  await expect(live.getByText("Every check passed.")).toBeVisible();
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Failed payments dashboard/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Readiness score" })).toContainText("Every check passed.");

  // A bare story: seven checks fail, but there are four things to fix.
  await page.goto(page.url().replace(/\/stories\/.*$/, "/stories/new"));
  await page.getByLabel("Title").fill("Admin dashboard");
  await page.getByRole("button", { name: "Score and save" }).click();
  const breakdown = page.getByRole("region", { name: "Readiness score" });
  await expect(breakdown.getByText("4 things to fix")).toBeVisible();
  await expect(breakdown.getByText(/No acceptance criteria, so nothing can be tested/)).toBeVisible();
  await expect(breakdown.getByText("−35")).toBeVisible();
  await expectAccessible(page);
});
