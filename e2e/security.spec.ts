import { expect, test } from "@playwright/test";
import { BASE_URL } from "./base-url";
import { signIn } from "./helpers";

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

test("security.txt points researchers to private reporting", async ({ request }) => {
  const response = await request.get("/.well-known/security.txt");
  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text).toContain("Contact: https://github.com/NaderAbsy/sprintwise/security/advisories/new");
  const expires = new Date(/Expires: (\S+)/.exec(text)![1]);
  expect(expires.getTime()).toBeGreaterThan(Date.now());
});

test("the Atlassian account report runs safely when called, and with no Jira accounts reports nothing", async ({ request }) => {
  const response = await request.get("/api/cron/atlassian-accounts");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ reported: 0, closed: 0 });
});

test("the browser can't fetch a user's stored GitHub or Atlassian tokens", async ({ page }) => {
  await signIn(page);
  for (const path of ["/api/auth/get-access-token", "/api/auth/refresh-token"]) {
    const response = await page.request.post(path, { headers: { Origin: BASE_URL }, data: { providerId: "github" } });
    expect(response.status(), path).toBe(404);
  }
  expect((await page.request.get("/api/auth/account-info")).status()).toBe(404);
});

test("the content security policy blocks nothing the app itself uses", async ({ page }) => {
  const blocked: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) blocked.push(`${page.url()}: ${message.text()}`);
  });
  for (const path of ["/", "/demo", "/demo/report", "/guide", "/changelog"]) await page.goto(path, { waitUntil: "networkidle" });
  await signIn(page);
  await page.goto("/projects");
  await page.getByLabel("Name").fill("CSP");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  await page.getByRole("button", { name: /sample stories/i }).first().click();
  await expect(page.getByRole("link", { name: /TIDY-101/ })).toBeVisible();
  await page.getByRole("link", { name: /TIDY-101/ }).click();
  await page.waitForLoadState("networkidle");
  expect(blocked).toEqual([]);
  const csp = (await page.request.get("/")).headers()["content-security-policy"];
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("form-action 'self';");
});
