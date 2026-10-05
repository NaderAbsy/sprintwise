import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

const isoDay = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

async function projectWithSamples(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: /load 12 sample stories/ }).click();
  await expect(page.getByText("Imported and scored 12 stories.")).toBeVisible();
  return page.url().split("?")[0];
}

/** Types a new value into an inline field and leaves it, which saves it. */
async function quickEdit(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: true });
  await field.fill(value);
  await field.press("Enter");
  await expect(page.getByLabel(`${label} saved`)).toBeVisible();
}

test("a sprint built from the backlog records status and points changes by itself", async ({ page }) => {
  test.setTimeout(90_000);
  const project = await projectWithSamples(page, "Live sprint");
  await page.goto(`${project}/sprints/new`);
  await page.getByLabel("Name").fill("Sprint 1");
  await page.getByRole("button", { name: "Create sprint" }).click();
  for (const key of ["TIDY-101", "TIDY-102"]) await page.getByRole("checkbox", { name: new RegExp(key) }).check();
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  await page.getByRole("dialog", { name: "Lock this baseline?" }).getByRole("button", { name: "Lock baseline" }).click();
  const inSprint = page.getByRole("region", { name: "In this sprint" });
  await expect(inSprint).toContainText("No need to save one.");
  const sprint = page.url();

  // Done on the sprint page: completion moves without saving a snapshot.
  await expect(inSprint.getByRole("row")).toHaveCount(3);
  await quickEdit(page, "Status of TIDY-102", "Done");
  const metrics = page.getByRole("region", { name: "Sprint metrics" });
  await expect(metrics).toContainText("Completion37.5%");
  await expect(page.getByRole("region", { name: "Change log" })).toContainText("Status changed");
  await expect(page.getByText("Recorded automatically")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Undo baseline" })).toHaveCount(0);
  await expectAccessible(page);

  // Re-estimate from the backlog: still one snapshot for today.
  await page.goto(project);
  await quickEdit(page, "Points for TIDY-101", "8");
  await page.goto(sprint);
  await expect(page.getByRole("region", { name: "Change log" })).toContainText("Re-estimated");
  await expect(page.getByText("Recorded automatically")).toHaveCount(1);
  await expect(page.getByText("Baseline 8 points · latest snapshot 11 points")).toBeVisible();

  // A reason tagged on today's change survives further edits the same day.
  await page.getByLabel("Why TIDY-101 changed").selectOption({ label: "Discovered work" });
  await expect(page.getByLabel("Saved")).toBeVisible();
  await quickEdit(page, "Status of TIDY-102", "In Progress");
  await expect(page.getByLabel("Why TIDY-101 changed")).toHaveValue("discovered");
  await expect(page.getByText("Recorded automatically")).toHaveCount(1);

  // Undo both edits: today's automatic snapshot goes away, and so does the change log.
  await quickEdit(page, "Status of TIDY-102", "To Do");
  await quickEdit(page, "Points for TIDY-101", "5");
  await expect(page.getByText("No changes yet. The sprint matches its baseline.")).toBeVisible();
  await expect(page.getByText("Recorded automatically")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo baseline" })).toBeVisible();

  // Stories outside the sprint can change freely without touching it.
  await page.goto(project);
  await quickEdit(page, "Status of TIDY-109", "In Progress");
  await page.goto(sprint);
  await expect(page.getByText("No changes yet. The sprint matches its baseline.")).toBeVisible();
});

test("inline edits are checked, and Escape puts the old value back", async ({ page }) => {
  const project = await projectWithSamples(page, "Inline");
  const points = page.getByLabel("Points for TIDY-105", { exact: true });
  await points.fill("lots");
  await points.press("Enter");
  await expect(page.getByText("Points must be a number of 0 or more.")).toBeVisible();

  await points.fill("2");
  await points.press("Escape");
  await expect(points).toHaveValue("");

  // Points re-score the story: estimating TIDY-108 makes it Ready.
  await expect(page.getByRole("link", { name: "Ready 5", exact: true })).toBeVisible();
  await quickEdit(page, "Points for TIDY-108", "3");
  await expect(page.getByRole("link", { name: "Ready 6", exact: true })).toBeVisible();
  await page.goto(project);
  await expect(page.getByLabel("Points for TIDY-108", { exact: true })).toHaveValue("3");
  await expectAccessible(page);
});

test("a sprint kept up to date with CSVs reminds you when the last snapshot is old", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Stale");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Sprints" }).click();
  await page.getByRole("link", { name: "New sprint" }).click();
  await page.getByLabel("Name").fill("Sprint 9");
  await page.getByLabel("Start date").fill(isoDay(-6));
  await page.getByLabel("End date").fill(isoDay(7));
  await page.getByRole("button", { name: "Create sprint" }).click();

  await page.getByText("Upload a CSV").click();
  await page.getByLabel("Day-one CSV").setInputFiles({
    name: "day1.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("key,title,story_points,status\nA,Story A,5,To Do\nB,Story B,3,To Do"),
  });
  await page.getByLabel("As of").fill(isoDay(-6));
  await page.getByRole("button", { name: "Lock as baseline" }).click();
  await page.getByRole("dialog", { name: "Lock this baseline?" }).getByRole("button", { name: "Lock baseline" }).click();
  await expect(page.getByText(/The last snapshot is from .*, [56] days ago/)).toBeVisible();
  await expect(page.getByRole("region", { name: "In this sprint" })).toHaveCount(0);
});
