import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/** Bugs found by clicking through the live site like a user (2026-10-08), each kept fixed. */

async function newProject(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  return page.url().split("?")[0];
}

const tabs = (page: Page) => page.getByRole("navigation", { name: "Project sections" });

test("an empty project offers only ways to add stories", async ({ page }) => {
  await newProject(page, "Empty");
  await expect(page.getByRole("link", { name: "Score a story" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Refinement" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share" })).toHaveCount(0);
});

test("a new story starts as To Do, and editing it shows no change until something changes", async ({ page }) => {
  const project = await newProject(page, "New story");
  await page.goto(`${project}/stories/new`);
  await page.getByLabel("Title").fill("Rebook my last cleaner");
  await page.getByLabel("Description").fill("As a repeat customer, I want to rebook my last cleaner so that I keep someone I trust.");
  await page.getByLabel(/Acceptance criteria/).fill("- My last cleaner is offered first\n- Rebooking takes two taps");
  await page.getByLabel("Story points").fill("3");
  await page.getByRole("button", { name: "Score and save" }).click();
  await expect(page.getByRole("heading", { name: "Rebook my last cleaner" })).toBeVisible();
  await expect(page.getByText("To Do", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: /Written or edited here, not yet in Jira/ })).toBeVisible();

  await page.getByRole("link", { name: "Edit story" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Rebook my last cleaner");
  await expect(page.getByText("Changed", { exact: true })).toHaveCount(0);
  await page.getByLabel("Title").fill("Rebook my last cleaner fast");
  await expect(page.getByText("Changed", { exact: true })).toHaveCount(1);
});

test("after an import the Backlog tab is the one lit, and second-look counts follow the filter", async ({ page }) => {
  const project = await newProject(page, "Import tab");
  await tabs(page).getByRole("link", { name: "Import" }).click();
  await expect(tabs(page).getByRole("link", { name: "Import" })).toHaveAttribute("aria-current", "page");
  const csv = [
    "key,title,description,acceptance_criteria,story_points,status",
    'QA-1,Refund a booking,"Certainly! Here\'s a user story: As a customer, I want a refund when I cancel so that I\'m not charged.","- The refund shows on the order page",3,To Do',
    "QA-2,Make search fast,,,8,To Do",
  ].join("\n");
  await page.getByLabel("CSV file").setInputFiles({ name: "qa.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Import 2 stories" }).click();
  await expect(page.getByText("Imported and scored 2 stories.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${project.replace(/[/.]/g, "\\$&")}\\?imported=2$`));
  await expect(tabs(page).getByRole("link", { name: "Backlog" })).toHaveAttribute("aria-current", "page");
  await expect(tabs(page).locator("[aria-current=page]")).toHaveCount(1);

  // QA-1 needs a second look and is Needs work; QA-2 is Not ready. Filtered to Not ready, no second look is offered.
  await expect(page.getByRole("link", { name: "1 worth a second look" })).toBeVisible();
  await page.getByRole("navigation", { name: "Filter by band" }).getByRole("link", { name: /Not ready/ }).click();
  await expect(page).toHaveURL(/band=not-ready/);
  await expect(page.getByRole("link", { name: /worth a second look/ })).toHaveCount(0);
});
