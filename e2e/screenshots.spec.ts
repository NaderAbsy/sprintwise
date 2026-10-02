import { test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// Regenerates the README screenshots in docs/screenshots. Run with `pnpm screenshots`.
// Every story, sprint and number shown is invented sample data.
const OUT = "docs/screenshots";
const csv = (rows: string[]) => Buffer.from(["key,title,description,acceptance_criteria,story_points,status", ...rows].join("\n"));

async function shot(page: Page, name: string, scheme: "light" | "dark", fullPage = false) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/${name}-${scheme}.png`, fullPage });
}

test.use({ viewport: { width: 1440, height: 900 } });

test("@screenshots public pages", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.goto("/");
    await shot(page, "landing", scheme);
    await page.goto("/demo");
    await shot(page, "demo-backlog", scheme);
    await page.goto("/demo#sample-sprint");
    await page.waitForTimeout(300);
    await shot(page, "demo-sprint", scheme);
    await page.goto("/demo/report");
    await shot(page, "sprint-report", scheme);
  }
});

test("@screenshots signed-in pages", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Payments team (sample data)");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("main").getByRole("link", { name: "Import CSV" }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "backlog.csv",
    mimeType: "text/csv",
    buffer: csv([
      'PAY-1,Refund a payment,"As an agent I want to refund a payment so that the customer gets their money back","- Full and partial refunds\n- The customer gets an email within 1 minute",3,To Do',
      "PAY-2,Fast and easy reports,Reports should be quick and user-friendly.,- Reports load fast,8,To Do",
      'PAY-3,Export statements,"As a customer I want to export statements so that I can file taxes","- CSV and PDF formats\n- Statements cover any 12-month range",5,To Do',
      'PAY-4,Save a card,"As a returning customer I want to save a card so that",- The last four digits are shown,,To Do',
      "PAY-5,Admin dashboard,,,,To Do",
    ]),
  });
  await page.getByRole("button", { name: /Import 5 stories/ }).click();
  await page.waitForURL(/imported=/);
  await page.goto(page.url().split("?")[0]);
  for (const scheme of ["light", "dark"] as const) await shot(page, "backlog", scheme);

  await page.getByRole("link", { name: /Fast and easy reports/ }).click();
  await page.waitForURL(/stories\//);
  for (const scheme of ["light", "dark"] as const) await shot(page, "story", scheme);
});
