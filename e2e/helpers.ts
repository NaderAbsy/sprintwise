import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { BASE_URL } from "./base-url";

/** Signs up a fresh test user through the test-only email sign-in; cookies land in the page's context. */
export async function signIn(page: Page) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: BASE_URL },
    data: { email: `e2e-${id}@example.test`, password: `e2e-password-${id}`, name: "E2E Tester" },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

/** Zero serious or critical accessibility issues (stories L-2, Gate 5). */
export async function expectAccessible(page: Page) {
  // Scroll reveals start transparent; reduced motion shows everything at once, so contrast is measured as seen.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}
