import { defineConfig, devices } from "@playwright/test";
import { BASE_URL as baseURL, PORT } from "./e2e/base-url";

/** End-to-end tests run against a production build with test sign-in switched on. */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { ENABLE_TEST_SIGN_IN: "true", AI_FAKE_RESPONSES: "true", BETTER_AUTH_URL: baseURL },
  },
});
