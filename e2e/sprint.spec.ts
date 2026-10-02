import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

const header = "key,title,story_points,status";
const csv = (rows: string[]) => Buffer.from([header, ...rows].join("\n"));

// The worked example from the requirements doc.
const baseline = csv(["A,Story A,5,To Do", "B,Story B,3,To Do", "C,Story C,8,To Do", "D,Story D,8,To Do", "E,Story E,6,To Do"]);
const latest = csv(["A,Story A,8,Done", "C,Story C,8,Done", "D,Story D renamed,8,Done", "E,Story E,6,In progress", "F,Story F,5,Done"]);

async function createSprint(page: Page) {
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Sprint tracking");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Sprints" }).click();
  await page.getByRole("link", { name: "New sprint" }).click();
  await page.getByLabel("Name").fill("Sprint 14");
  await page.getByLabel("Start date").fill("2026-10-05");
  await page.getByLabel("End date").fill("2026-10-16");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await expect(page.getByRole("heading", { name: "Sprint 14" })).toBeVisible();
}

test("S-1: a sprint needs a name and an end date after its start", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Validation");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Sprints" }).click();
  await page.getByRole("link", { name: "New sprint" }).click();
  await page.getByLabel("Start date").fill("2026-10-05");
  await page.getByLabel("End date").fill("2026-10-05");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await expect(page.getByText("Give the sprint a name.")).toBeVisible();
  await expect(page.getByText("The end date must be after the start date.")).toBeVisible();
});

test("a sprint reproduces the worked example from baseline to metrics", async ({ page }) => {
  await signIn(page);
  await createSprint(page);
  await expectAccessible(page);

  // S-2: preview shows the baseline total, locking asks for confirmation.
  await page.getByLabel("Day-one CSV").setInputFiles({ name: "day1.csv", mimeType: "text/csv", buffer: baseline });
  await page.getByLabel("As of").fill("2026-10-05");
  await expect(page.getByText("5 stories, 30 points in total")).toBeVisible();
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Once locked it can't be edited or replaced/)).toBeVisible();
  await dialog.getByRole("button", { name: "Lock baseline" }).click();

  await expect(page.getByText("Baseline 30 points · latest snapshot 30 points")).toBeVisible();
  await expect(page.getByText("Baseline · locked")).toBeVisible();
  // There is no way to replace the baseline any more.
  await expect(page.getByLabel("Day-one CSV")).toHaveCount(0);

  // S-3: a later snapshot before the baseline's date is rejected.
  const snapshotFile = page.getByLabel("Snapshot CSV");
  await snapshotFile.setInputFiles({ name: "day4.csv", mimeType: "text/csv", buffer: latest });
  await page.getByLabel("As of").fill("2026-10-04");
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText("The date must be within the sprint (5 Oct 2026 to 16 Oct 2026).")).toBeVisible();

  // The preview lists what changed, matched by key (a rename is not a removal).
  await page.getByLabel("As of").fill("2026-10-08");
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByRole("row")).toHaveCount(1 + 8);
  await expect(preview.getByRole("row", { name: /D Renamed/ })).toBeVisible();
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText("Snapshot saved with 8 changes.")).toBeVisible();

  // S-4: exactly the documented numbers.
  const metrics = page.getByRole("region", { name: "Sprint metrics" });
  await expect(metrics.getByText("Baseline 30 points · latest snapshot 35 points")).toBeVisible();
  await expect(metrics.locator("dd", { hasText: "5 pts" }).first()).toBeVisible();
  await expect(metrics.getByText("3 pts")).toBeVisible();
  await expect(metrics.getByText("+16.7%")).toBeVisible();
  await expect(metrics.getByText("36.7%")).toBeVisible();
  await expect(metrics.getByText("70.0%")).toBeVisible();

  const log = page.getByRole("region", { name: "Change log" });
  await expect(log.getByRole("row", { name: /8 Oct 2026 A Re-estimated 5 → 8 pts \+3/ })).toBeVisible();
  await expect(log.getByRole("row", { name: /B Removed 3 pts −3/ })).toBeVisible();
  await expect(log.getByRole("row", { name: /F Added 5 pts \+5/ })).toBeVisible();
  await expectAccessible(page);

  // S-6: deleting the sprint asks first and keeps the project.
  await page.getByRole("button", { name: "Delete sprint" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete sprint" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sprints" })).toBeVisible();
  await expect(page.getByText("No sprints yet.")).toBeVisible();
});
