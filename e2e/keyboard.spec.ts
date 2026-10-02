import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// L-2: "Fully usable by keyboard." These tests use only Tab, Shift+Tab, Enter, Space, arrows and Escape.

/** Presses Tab until the focused element matches, failing after `max` presses. */
async function tabTo(page: Page, matches: (el: { name: string; tag: string }) => boolean, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const el = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return {
        name: (a?.getAttribute("aria-label") || a?.textContent || "").trim().replace(/\s+/g, " "),
        tag: a?.tagName.toLowerCase() ?? "",
      };
    });
    if (matches(el)) return;
  }
  throw new Error("Element not reached by keyboard");
}

const focusedName = (page: Page) =>
  page.evaluate(() => (document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent || "").trim());

test("the skip link is first and jumps to the main content", async ({ page }) => {
  await page.goto("/demo");
  await page.keyboard.press("Tab");
  expect(await focusedName(page)).toBe("Skip to content");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("the theme switch is one Tab stop, changed with the arrow keys", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await tabTo(page, (el) => ["Light", "Dark", "System"].includes(el.name));
  expect(await focusedName(page)).toBe("System");
  await page.keyboard.press("ArrowLeft");
  expect(await focusedName(page)).toBe("Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  // The next Tab leaves the group instead of visiting the other options.
  await page.keyboard.press("Tab");
  expect(["Light", "Dark", "System"]).not.toContain(await focusedName(page));
});

test("the demo works by keyboard", async ({ page }) => {
  await page.goto("/demo");
  await tabTo(page, (el) => el.name.startsWith("TIDY-103"));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "TIDY-103 Fast and easy checkout" })).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "TIDY-110 Improve the search" })).toBeVisible();

  await page.getByLabel("Title").focus();
  await page.keyboard.type("Make it fast");
  await tabTo(page, (el) => el.name === "Score this story");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/The story uses vague words: "fast"/)).toBeVisible();
});

test("on a phone, the closed menu is out of the Tab order and the open one traps nothing", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects");

  // Closed: Tab never lands inside the off-screen drawer.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("#app-nav"))).toBe(false);
  }

  // Open: focus moves into the drawer; Escape closes it and returns focus to the menu button.
  await page.getByRole("button", { name: "Open menu" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("#app-nav"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});

test("a signed-in flow works end to end by keyboard, including the delete dialog", async ({ page }) => {
  await signIn(page);
  await page.goto("/projects");

  await tabTo(page, (el) => el.tag === "input");
  await page.keyboard.type("Keyboard project");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Backlog" })).toBeVisible();

  await tabTo(page, (el) => el.name === "Score a story");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Score a story" })).toBeVisible();
  await tabTo(page, (el) => el.tag === "input"); // Key
  await page.keyboard.press("Tab"); // Title
  await page.keyboard.type("Export invoices");
  await tabTo(page, (el) => el.name === "Score and save");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: /Export invoices/ })).toBeVisible();

  // The native dialog takes focus (Cancel first), Escape closes it, and Enter on the confirm button deletes.
  await tabTo(page, (el) => el.name === "Delete story");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await focusedName(page)).toBe("Cancel");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Delete story" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  expect(await focusedName(page)).toBe("Delete story");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Backlog" })).toBeVisible();
  await expect(page.getByText("No stories yet.")).toBeVisible();
});
