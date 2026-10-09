import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { BASE_URL } from "./base-url";
import { expectAccessible, signIn } from "./helpers";

const isPng = async (page: Page, path: string) => {
  const response = await page.request.get(path);
  return response.ok() && response.headers()["content-type"] === "image/png" && (await response.body()).subarray(1, 4).toString() === "PNG";
};

test("public pages point link previews at the Sprintwise card", async ({ page }) => {
  await page.goto("/");
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toContain("/opengraph-image");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  expect(await isPng(page, new URL(image!).pathname + new URL(image!).search)).toBe(true);
});

test("a shared backlog has its own preview, gone once sharing is off", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("Preview backlog");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: /load 12 sample stories/ }).click();
  await expect(page.getByText("Imported and scored 12 stories.")).toBeVisible();
  await page.getByRole("button", { name: "Share" }).click();
  const dialog = page.getByRole("dialog", { name: "Share this backlog" });
  await dialog.getByRole("button", { name: "Create link" }).click();
  const link = new URL(await dialog.getByLabel("Link").inputValue()).pathname;

  const stranger = await page.context().browser()!.newContext();
  const visitor = await stranger.newPage();
  await visitor.goto(link);
  const image = await visitor.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toContain(`${link}/opengraph-image`);
  const imagePath = new URL(image!).pathname;
  expect(await isPng(visitor, imagePath)).toBe(true);

  await dialog.getByRole("button", { name: "Turn off the link" }).click();
  await expect(dialog.getByRole("button", { name: "Create link" })).toBeVisible();
  expect((await visitor.request.get(imagePath)).status()).toBe(404);
  await stranger.close();
});

test("insights are only for whoever runs the site, and show totals, never who", async ({ page, browser }) => {
  // A regular user gets a 404 and no link on their Account page.
  await signIn(page);
  // The account area streams a loading state first, so the status is already sent; the page itself is "not found".
  await page.goto("/account/insights");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByText("From sign-up to a tracked sprint")).toHaveCount(0);
  await page.goto("/account");
  await expect(page.getByRole("link", { name: "Open insights" })).toHaveCount(0);

  // The test-only site owner address (never usable on a deploy) sees the page.
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const id = randomBytes(6).toString("hex");
  const response = await owner.request.post("/api/auth/sign-up/email", {
    headers: { Origin: BASE_URL },
    data: { email: `site-owner-${id}@example.test`, password: `owner-password-${id}`, name: "Site Owner" },
  });
  expect(response.ok()).toBe(true);
  await owner.goto("/account");
  await owner.getByRole("link", { name: "Open insights" }).click();
  await expect(owner.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  const funnel = owner.getByRole("region", { name: "From sign-up to a tracked sprint" });
  await expect(funnel.getByRole("listitem")).toHaveCount(5);
  await expect(funnel).toContainText("Signed up");
  // Only numbers: the regular user's name and email appear nowhere.
  await expect(owner.locator("main")).not.toContainText("E2E Tester");
  await expect(owner.locator("main")).not.toContainText("@example.test");
  await expectAccessible(owner);
  await ownerContext.close();
});
