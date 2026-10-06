import { expect, request as playwrightRequest, test, type Page } from "@playwright/test";
import { BASE_URL } from "./base-url";
import { expectAccessible, signIn } from "./helpers";

async function projectWithSamples(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: /load 12 sample stories/ }).click();
  await expect(page.getByText("Imported and scored 12 stories.")).toBeVisible();
  return page.url().split("?")[0];
}

async function lockFromBacklog(page: Page, keys: string[]) {
  for (const key of keys) await page.getByRole("checkbox", { name: new RegExp(key) }).check();
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Lock baseline" }).click();
  await expect(page.getByRole("region", { name: "Sprint metrics" })).toBeVisible();
}

test("goal, scope reasons, the report and a share link that can be turned off", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const project = await projectWithSamples(page, "Reasons");

  await page.goto(`${project}/sprints/new`);
  await page.getByLabel("Name").fill("Sprint 1");
  await page.getByLabel(/Sprint goal/).fill("Customers can cancel a booking themselves");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await expect(page.getByText("Customers can cancel a booking themselves")).toBeVisible();

  // The planning helper flags unready stories before they're committed.
  await page.getByRole("checkbox", { name: /TIDY-103/ }).check();
  await expect(page.getByText(/1 of 1 story isn't Ready: TIDY-103/)).toBeVisible();
  await page.getByRole("checkbox", { name: /TIDY-103/ }).uncheck();
  await lockFromBacklog(page, ["TIDY-101", "TIDY-102"]);

  // A stakeholder adds a story; the PO tags why.
  await page.getByRole("checkbox", { name: /TIDY-107/ }).check();
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText("Snapshot saved with 1 change.")).toBeVisible();
  await page.getByLabel("Why TIDY-107 changed").selectOption({ label: "Stakeholder request" });
  await expect(page.getByLabel("Saved")).toBeVisible();

  // Record the outcome.
  await page.getByRole("button", { name: /Edit goal/ }).click();
  await page.getByText("Partly met").click();
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByText("Goal saved.")).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("link", { name: "Open sprint report" }).click();
  await expect(page.getByRole("region", { name: "Why scope changed" })).toContainText(
    "100% of the scope that moved came from stakeholder requests.",
  );
  await expect(page.getByText("Partly met")).toBeVisible();

  // Share: anyone with the link sees the report, until it's turned off.
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create link" }).click();
  const link = await page.getByLabel("Link").inputValue();
  expect(link).toMatch(/\/share\/[A-Za-z0-9_-]{43}$/);
  await expectAccessible(page);

  const strangerContext = await browser.newContext();
  const stranger = await strangerContext.newPage();
  await stranger.goto(link);
  await expect(stranger.getByText("Shared read-only report")).toBeVisible();
  await expect(stranger.getByRole("heading", { level: 1, name: "Sprint 1" })).toBeVisible();
  await expect(stranger.getByRole("link", { name: /Back to/ })).toHaveCount(0);
  await expectAccessible(stranger);

  await page.getByRole("dialog").getByRole("button", { name: "Turn off the link" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Create link" })).toBeVisible();
  const gone = await stranger.goto(link);
  expect(gone?.status()).toBe(404);
  await strangerContext.close();
});

test("capacity from past sprints, and the Trends tab", async ({ page }) => {
  test.setTimeout(90_000);
  const project = await projectWithSamples(page, "Capacity");

  // Sprint 1: finish TIDY-102 (3 points).
  await page.goto(`${project}/sprints/new`);
  await page.getByLabel("Name").fill("Sprint 1");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await page.getByRole("checkbox", { name: /TIDY-101/ }).check();
  await expect(page.getByText("Once a sprint has a later snapshot", { exact: false })).toBeVisible();
  await lockFromBacklog(page, ["TIDY-101", "TIDY-102"]);
  const sprint1 = page.url();
  await page.goto(project);
  await page.getByRole("link", { name: /TIDY-102/ }).click();
  await page.getByRole("link", { name: "Edit story" }).click();
  await page.getByLabel("Status").fill("Done");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  // The sprint follows the backlog, so the edit is already recorded.
  await page.goto(sprint1);
  await expect(page.getByText("Recorded automatically")).toBeVisible();

  // Sprint 2: the helper knows the team finished 3 points.
  await page.goto(`${project}/sprints/new`);
  await page.getByLabel("Name").fill("Sprint 2");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await page.getByRole("checkbox", { name: /TIDY-101/ }).check();
  await expect(page.getByText(/the team usually finishes\s*3\s*pts/)).toBeVisible();
  await expect(page.getByText(/2 points more than the team usually finishes/)).toBeVisible();

  await page.goto(`${project}/trends`);
  await expect(page.getByRole("heading", { level: 1, name: "Trends" })).toBeVisible();
  await expect(page.getByText("3 pts", { exact: true })).toBeVisible(); // velocity card
  await page.getByText("Show the numbers as a table").click();
  await expect(page.getByRole("table", { name: "Sprint trends, oldest first" })).toContainText("Sprint 1");
  await expectAccessible(page);
});

test("export the backlog as CSV, only for its owner", async ({ page }) => {
  const project = await projectWithSamples(page, "Export");
  const response = await page.request.get(`${project}/export.csv`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain('filename="Export-backlog.csv"');
  const csv = await response.text();
  expect(csv.split("\r\n")[0]).toBe("﻿key,title,description,acceptance_criteria,story_points,status,readiness_score,band,failed_checks");
  expect(csv).toContain("TIDY-105,Admin dashboard");

  const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL });
  expect((await anonymous.get(`${project}/export.csv`, { maxRedirects: 0 })).status()).not.toBe(200);
  await anonymous.dispose();
});

test("team checks cap a story at Needs work until it passes them", async ({ page }) => {
  const project = await projectWithSamples(page, "Checks");
  await page.goto(`${project}/settings`);
  await page.getByRole("button", { name: "Has a design link" }).click();
  await page.getByRole("button", { name: "Save checks and re-score" }).click();
  await expect(page.getByText(/Saved 1 check\. 12 stories were re-scored\./)).toBeVisible();
  await expectAccessible(page);

  await page.goto(`${project}?band=ready`);
  await expect(page.getByText("No stories match.")).toBeVisible();
  await page.goto(project);
  await page.getByRole("link", { name: /TIDY-101/ }).click();
  await expect(page.getByText("Has a design link: failed")).toBeAttached();
  await expect(page.getByText(/Can't be Ready until it passes your team's checks: Has a design link\./)).toBeVisible();
});

test("writing help: templates, placeholder reminder and copy as text", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const project = await projectWithSamples(page, "Writing");
  await page.goto(`${project}/stories/new`);
  await page.getByLabel("Title").fill("Rebook a past cleaner quickly");
  await page.getByRole("button", { name: "Story template" }).click();
  await expect(page.getByLabel("Description")).toHaveValue("As a [type of user], I want [goal] so that [benefit].");
  await expect(page.getByText("Replace the [placeholders]", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Add a Given / When / Then" }).click();
  await expect(page.getByLabel(/Acceptance criteria/)).toHaveValue(/^- Given \[a starting situation\]/);
  await expect(page.getByText("“quickly”:", { exact: false })).toBeVisible();
  await expectAccessible(page);

  await page.goto(project);
  await page.getByRole("link", { name: /TIDY-101/ }).click();
  await page.getByRole("button", { name: "Copy as text" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^TIDY-101: /);
});
