import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("GITHUB_CLIENT_ID", "client-id");
vi.stubEnv("GITHUB_CLIENT_SECRET", "client-secret");

const getAccessToken = vi.fn();
const findFirst = vi.fn();
vi.mock("@/lib/server/auth", () => ({ auth: { api: { getAccessToken: (...a: unknown[]) => getAccessToken(...a) } } }));
vi.mock("@/lib/server/db", () => ({ db: { account: { findFirst: (...a: unknown[]) => findFirst(...a) } } }));

const { revokeGitHubGrant } = await import("@/lib/server/github");

describe("revokeGitHubGrant", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    findFirst.mockResolvedValue({ id: "acc-1" });
    getAccessToken.mockResolvedValue({ accessToken: "user-token" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("deletes the app's grant with the app's credentials and the user's token", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await revokeGitHubGrant("user-1")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/applications/client-id/grant");
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("client-id:client-secret").toString("base64")}`);
    expect(JSON.parse(init.body)).toEqual({ access_token: "user-token" });
  });

  it("never stops an account deletion: no account, no token, an error or GitHub down all return false", async () => {
    findFirst.mockResolvedValueOnce(null);
    expect(await revokeGitHubGrant("user-1")).toBe(false);
    getAccessToken.mockRejectedValueOnce(new Error("gone"));
    expect(await revokeGitHubGrant("user-1")).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await revokeGitHubGrant("user-1")).toBe(false);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 422 }));
    expect(await revokeGitHubGrant("user-1")).toBe(false);
  });
});
