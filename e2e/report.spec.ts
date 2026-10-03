import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

const header = "key,title,story_points,status";
const csv = (rows: string[]) => Buffer.from([header, ...rows].join("\n"));

async function sprintWithBaseline(page: Page, baseline: Buffer) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Report project");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Sprints" }).click();
  await page.getByRole("link", { name: "New sprint" }).click();
  await page.getByLabel("Name").fill("Sprint 15");
  await page.getByLabel("Start date").fill("2026-10-05");
  await page.getByLabel("End date").fill("2026-10-16");
  await page.getByRole("button", { name: "Create sprint" }).click();
  await page.getByLabel("Day-one CSV").setInputFiles({ name: "day1.csv", mimeType: "text/csv", buffer: baseline });
  await page.getByLabel("As of").fill("2026-10-05");
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Lock baseline" }).click();
  await expect(page.getByText("Baseline · locked")).toBeVisible();
}

async function uploadSnapshot(page: Page, snapshot: Buffer, day: string) {
  await page.getByLabel("Snapshot CSV").setInputFiles({ name: "later.csv", mimeType: "text/csv", buffer: snapshot });
  await page.getByLabel("As of").fill(day);
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText(/Snapshot saved/)).toBeVisible();
}

/** S-5 says the report fits one A4 page; print it the way a browser would and count pages. */
async function printedPages(page: Page): Promise<number> {
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  return pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
}

test("the sprint report shows the worked example on one page", async ({ page }) => {
  await sprintWithBaseline(
    page,
    csv(["A,Story A,5,To Do", "B,Story B,3,To Do", "C,Story C,8,To Do", "D,Story D,8,To Do", "E,Story E,6,To Do"]),
  );
  await uploadSnapshot(
    page,
    csv(["A,Story A,8,Done", "C,Story C,8,Done", "D,Story D renamed,8,Done", "E,Story E,6,In progress", "F,Story F,5,Done"]),
    "2026-10-08",
  );

  await page.getByRole("link", { name: "Open sprint report" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sprint 15" })).toBeVisible();
  await expect(
    page.getByText("Scope grew 16.7%, churn was 36.7%, and 70.0% of the original commitment was done."),
  ).toBeVisible();

  // Only scope changes are listed; status changes and the rename are counted instead.
  const log = page.getByRole("region", { name: "Scope changes" });
  await expect(log.getByRole("row")).toHaveCount(1 + 3);
  await expect(log.getByText("Not listed because they don't change scope: 4 status changes and 1 rename.")).toBeVisible();

  // Readiness of changed (A, B) versus unchanged (C, D, E) stories, scored as at the baseline.
  const readiness = page.getByRole("region", { name: "Readiness at the baseline" });
  await expect(readiness.getByText("Changed scope (2)")).toBeVisible();
  await expect(readiness.getByText("Unchanged (3)")).toBeVisible();
  await expect(readiness.getByText(/about the same/)).toBeVisible();

  await expectAccessible(page);
  expect(await printedPages(page)).toBe(1);
});

test("a long change log still prints on one page", async ({ page }) => {
  const stories = Array.from({ length: 30 }, (_, i) => `K-${i + 1},Story ${i + 1},3,To Do`);
  await sprintWithBaseline(page, csv(stories));
  // Remove 25 of 30 stories: 25 scope changes, more than the report lists.
  await uploadSnapshot(page, csv(stories.slice(0, 5)), "2026-10-09");

  await page.getByRole("link", { name: "Open sprint report" }).click();
  await expect(page.getByText(/Showing the 15 most recent of 25/)).toBeVisible();
  expect(await printedPages(page)).toBe(1);
});
