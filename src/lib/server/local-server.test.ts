import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { isLocalServer, testFlag } = await import("@/lib/server/local-server");
const { cronAllowed } = await import("@/lib/server/cron");
const { errorSummary } = await import("@/lib/server/log");

afterEach(() => vi.unstubAllEnvs());

describe("isLocalServer", () => {
  it("accepts only this machine", () => {
    for (const url of ["http://localhost:3100", "http://127.0.0.1:3000", "http://[::1]:3000", "http://app.localhost:3000"]) expect(isLocalServer(url), url).toBe(true);
    for (const url of ["https://sprintwise.app", "http://localhost.evil.example", "http://10.0.0.5:3000", "", undefined, "not a url"]) expect(isLocalServer(url), String(url)).toBe(false);
  });
});

describe("testFlag", () => {
  it("is off unless set", () => {
    vi.stubEnv("JIRA_FAKE", "");
    expect(testFlag("JIRA_FAKE")).toBe(false);
  });

  it("turns on only for a local server", () => {
    vi.stubEnv("ENABLE_TEST_SIGN_IN", "true");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3100");
    expect(testFlag("ENABLE_TEST_SIGN_IN")).toBe(true);
  });

  it("refuses on Vercel, and on a real address even off Vercel (a copy of the repo run elsewhere)", () => {
    vi.stubEnv("ENABLE_TEST_SIGN_IN", "true");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3100");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => testFlag("ENABLE_TEST_SIGN_IN")).toThrow(/Vercel/);
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("BETTER_AUTH_URL", "https://tracker.example.org");
    expect(() => testFlag("ENABLE_TEST_SIGN_IN")).toThrow(/local server/);
    vi.stubEnv("BETTER_AUTH_URL", "");
    expect(() => testFlag("JIRA_FAKE") && 0).not.toThrow();
    vi.stubEnv("JIRA_FAKE", "true");
    expect(() => testFlag("JIRA_FAKE")).toThrow(/local server/);
  });
});

describe("cronAllowed", () => {
  const request = (authorization?: string) => ({ headers: new Headers(authorization ? { authorization } : {}) }) as never;

  it("needs the secret when one is set, compared exactly", () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value-long-enough");
    expect(cronAllowed(request("Bearer s3cret-value-long-enough"))).toBe(true);
    for (const header of [undefined, "Bearer wrong", "Bearer ", "Bearer undefined", "s3cret-value-long-enough", "bearer s3cret-value-long-enough", "Bearer s3cret-value-long-enougH"]) {
      expect(cronAllowed(request(header)), String(header)).toBe(false);
    }
  });

  it("without a secret, runs open only on a local development server", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3100");
    expect(cronAllowed(request())).toBe(true);
    vi.stubEnv("BETTER_AUTH_URL", "https://sprintwise.app");
    expect(cronAllowed(request())).toBe(false);
    vi.stubEnv("BETTER_AUTH_URL", "");
    expect(cronAllowed(request())).toBe(false);
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3100");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(cronAllowed(request())).toBe(false);
  });
});

describe("errorSummary", () => {
  it("keeps a short message for ordinary errors", () => {
    expect(errorSummary(new TypeError("fetch failed"))).toBe("TypeError: fetch failed");
    expect(errorSummary(new Error("x".repeat(500))).length).toBeLessThan(230);
  });

  it("keeps only the name and code of database errors, which can quote the data being saved", () => {
    class PrismaClientValidationError extends Error {
      name = "PrismaClientValidationError";
      code = "P2000";
    }
    const error = new PrismaClientValidationError("Invalid `create()`: data: { title: 'My secret customer story' }");
    expect(errorSummary(error)).toBe("PrismaClientValidationError P2000");
    expect(errorSummary("a string")).not.toContain("a string");
  });
});
