import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

test("the demo opens without signing in and saves nothing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText("5 of 12 stories ready")).toBeVisible();
  await expect(page.getByText("Demo: invented sample data, nothing is saved")).toBeVisible();

  // The weakest story is listed first and open by default.
  await expect(page.getByRole("heading", { name: "TIDY-105 Admin dashboard" })).toBeVisible();

  await page.getByRole("button", { name: /TIDY-103/ }).click();
  await expect(page.getByText('The story uses vague words: "fast", "quick", "easy", "user-friendly".')).toBeVisible();
});

test("the demo scores a pasted story in the browser", async ({ page }) => {
  await page.goto("/demo");
  const requests: string[] = [];
  // Link prefetches are GETs; scoring must not send anything.
  page.on("request", (r) => r.method() !== "GET" && requests.push(r.url()));

  await page.getByRole("button", { name: "Score this story" }).click();
  await expect(page.getByText("Paste a story title to score.")).toBeVisible();

  await page.getByLabel("Title").fill("Export invoices");
  await page.getByLabel("Description").fill("As a finance admin I want to export invoices so that I can send them to clients");
  await page.getByLabel(/Acceptance criteria/).fill("- A PDF downloads\n- It matches the screen");
  await page.getByLabel("Story points").fill("3");
  await page.getByRole("button", { name: "Score this story" }).click();

  await expect(page.getByText("Every check passed.")).toBeVisible();
  expect(requests).toEqual([]);
});

test("signed-out visitors are sent to the landing page", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/$/);
});

test("the template downloads with the frozen columns", async ({ request }) => {
  const response = await request.get("/template.csv");
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect((await response.text()).split("\n")[0]).toBe("key,title,description,acceptance_criteria,story_points,status");
});

for (const path of ["/", "/demo", "/privacy"]) {
  test(`${path} has no serious accessibility issues`, async ({ page }) => {
    await page.goto(path);
    await expectAccessible(page);
  });
}
