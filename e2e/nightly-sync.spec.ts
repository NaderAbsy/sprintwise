import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

// Runs against the pretend Jira (JIRA_FAKE), which holds invented issues SHOP-1 to SHOP-4.
test("the nightly sync updates a Jira project with a running sprint, and can be turned off", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Nightly project");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  const project = new URL(page.url()).pathname;
  const projectId = project.split("/")[2];

  await page.goto(`${project}/import`);
  await page.getByRole("region", { name: "From Jira" }).getByRole("button", { name: "Preview issues" }).click();
  await page.getByRole("button", { name: "Import 3 stories" }).click();
  await expect(page.getByText("Imported and scored 3 stories.")).toBeVisible();

  // Without a running sprint that follows the backlog, there's nothing to record, so it's left out.
  let nightly = await (await page.request.get("/api/cron/jira-sync")).json();
  expect(nightly.synced).not.toContain(projectId);

  // A sprint built from the backlog, running today.
  await page.goto(`${project}/sprints/new`);
  await page.getByLabel("Name").fill("Sprint 1");
  await page.getByRole("button", { name: "Create sprint" }).click();
  for (const key of ["SHOP-1", "SHOP-2"]) await page.getByRole("checkbox", { name: new RegExp(key) }).check();
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  await page.getByRole("dialog", { name: "Lock this baseline?" }).getByRole("button", { name: "Lock baseline" }).click();
  await expect(page.getByRole("region", { name: "In this sprint" })).toBeVisible();

  nightly = await (await page.request.get("/api/cron/jira-sync")).json();
  expect(nightly.synced).toContain(projectId);
  await page.goto(project);
  await expect(page.getByText(/From Example Jira, last synced .+ automatically\./)).toBeVisible();

  // A click on Sync is no longer "automatically".
  await page.getByRole("button", { name: "Sync from Jira" }).click();
  await expect(page.getByText(/Synced from Jira:/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/From Example Jira, last synced [^.]+\./)).not.toContainText("automatically");

  // Turned off in Settings: the next night skips it.
  await page.goto(`${project}/settings`);
  const section = page.getByRole("region", { name: "Jira sync" });
  await expect(section).toContainText("Nightly sync is on.");
  await expectAccessible(page);
  await section.getByRole("button", { name: "Turn off nightly sync" }).click();
  await expect(section).toContainText("Nightly sync is off.");
  nightly = await (await page.request.get("/api/cron/jira-sync")).json();
  expect(nightly.synced).not.toContain(projectId);
});
