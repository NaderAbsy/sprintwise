import { expect, test } from "@playwright/test";

test("every response carries the security headers", async ({ request }) => {
  for (const path of ["/", "/demo", "/projects"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-powered-by"]).toBeUndefined();
  }
});

test("signed-out visitors can't open another user's project", async ({ page }) => {
  await page.goto("/projects/not-yours/stories/new");
  await expect(page).toHaveURL(/\/$/);
});
