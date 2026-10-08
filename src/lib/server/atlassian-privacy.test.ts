import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.stubEnv("ATLASSIAN_CLIENT_ID", "id");
vi.stubEnv("ATLASSIAN_CLIENT_SECRET", "secret");
vi.stubEnv("JIRA_FAKE", "");

const getAccessToken = vi.fn();
vi.mock("@/lib/server/auth", () => ({ auth: { api: { getAccessToken: (...args: unknown[]) => getAccessToken(...args) } } }));

type Report = { accountId: string; nextReportAt: Date };
const state = { accounts: [] as { id: string; userId: string; accountId: string; updatedAt: Date }[], reports: [] as Report[] };
const inList = (where: { accountId: { in: string[] } }) => (r: { accountId: string }) => where.accountId.in.includes(r.accountId);
vi.mock("@/lib/server/db", () => ({
  db: {
    account: {
      findMany: async () => state.accounts,
      deleteMany: async ({ where }: { where: { accountId: { in: string[] } } }) => {
        state.accounts = state.accounts.filter((a) => !inList(where)(a));
      },
    },
    atlassianReport: {
      findMany: async () => state.reports,
      deleteMany: async ({ where }: { where: { accountId: { in: string[] } } }) => {
        state.reports = state.reports.filter((r) => !inList(where)(r));
      },
      upsert: ({ create }: { create: Report }) => {
        state.reports = [...state.reports.filter((r) => r.accountId !== create.accountId), create];
      },
    },
    $transaction: async (ops: unknown[]) => ops,
  },
}));

const { closedAccounts, cyclePeriod, dueAccounts, reportAtlassianAccounts } = await import("@/lib/server/atlassian-privacy");

const now = new Date("2026-10-08T03:00:00Z");
const day = 24 * 60 * 60 * 1000;
const account = (n: number, updatedAt = new Date("2026-10-01T00:00:00Z")) => ({ id: `acc-${n}`, userId: `user-${n}`, accountId: `atl-${n}`, updatedAt });

describe("dueAccounts", () => {
  it("lists IDs never reported or whose cycle is up, once each with the newest data", () => {
    const older = new Date("2026-09-01T00:00:00Z");
    const newer = new Date("2026-10-01T00:00:00Z");
    const due = dueAccounts(
      [
        { accountId: "a", updatedAt: older },
        { accountId: "a", updatedAt: newer },
        { accountId: "b", updatedAt: older },
        { accountId: "c", updatedAt: older },
      ],
      new Map([
        ["b", new Date(now.getTime() + day)],
        ["c", new Date(now.getTime() - 1)],
      ]),
      now,
    );
    expect(due).toEqual([
      { accountId: "a", updatedAt: newer },
      { accountId: "c", updatedAt: older },
    ]);
  });
});

describe("cyclePeriod and closedAccounts", () => {
  it("reads Atlassian's cycle in seconds, falling back to 7 days", () => {
    expect(cyclePeriod("1209600")).toBe(14 * day);
    expect(cyclePeriod(null)).toBe(7 * day);
    expect(cyclePeriod("soon")).toBe(7 * day);
    expect(cyclePeriod("5")).toBe(7 * day);
  });

  it("picks out the closed accounts only", () => {
    expect(
      closedAccounts({
        accounts: [
          { accountId: "a", status: "closed" },
          { accountId: "b", status: "updated" },
          { status: "closed" },
        ],
      }),
    ).toEqual(["a"]);
    expect(closedAccounts(null)).toEqual([]);
  });
});

describe("reportAtlassianAccounts", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    getAccessToken.mockReset();
    getAccessToken.mockResolvedValue({ accessToken: "token" });
    state.accounts = [];
    state.reports = [];
  });
  afterEach(() => vi.unstubAllGlobals());

  it("does nothing when no account is due", async () => {
    state.accounts = [account(1)];
    state.reports = [{ accountId: "atl-1", nextReportAt: new Date(now.getTime() + day) }];
    expect(await reportAtlassianAccounts(now)).toEqual({ reported: 0, closed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports in batches of 90, deletes closed accounts, and schedules the next report", async () => {
    state.accounts = Array.from({ length: 95 }, (_, i) => account(i));
    state.reports = [{ accountId: "atl-gone", nextReportAt: now }];
    fetchMock
      .mockResolvedValueOnce(Response.json({ accounts: [{ accountId: "atl-3", status: "closed" }] }, { headers: { "Cycle-Period": "1209600" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    expect(await reportAtlassianAccounts(now)).toEqual({ reported: 95, closed: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.atlassian.com/app/report-accounts/");
    expect(init.headers.Authorization).toBe("Bearer token");
    const body = JSON.parse(init.body);
    expect(body.accounts).toHaveLength(90);
    expect(body.accounts[0]).toEqual({ accountId: "atl-0", updatedAt: "2026-10-01T00:00:00.000Z" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).accounts).toHaveLength(5);

    // The closed account's connection is gone; the disconnected ID is forgotten.
    expect(state.accounts.some((a) => a.accountId === "atl-3")).toBe(false);
    expect(state.reports.some((r) => r.accountId === "atl-3" || r.accountId === "atl-gone")).toBe(false);
    // The first batch follows Atlassian's 14-day cycle; the second, the default 7 days.
    expect(state.reports.find((r) => r.accountId === "atl-0")?.nextReportAt).toEqual(new Date(now.getTime() + 14 * day));
    expect(state.reports.find((r) => r.accountId === "atl-94")?.nextReportAt).toEqual(new Date(now.getTime() + 7 * day));
    expect(state.reports).toHaveLength(94);
  });

  it("stops when Atlassian is busy, leaving the accounts due for the next run", async () => {
    state.accounts = [account(1)];
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "60" } }));
    expect(await reportAtlassianAccounts(now)).toEqual({ reported: 0, closed: 0, retryAfterSeconds: 60 });
    expect(state.reports).toEqual([]);
  });

  it("tries the next account when one's token has expired, and says so when none works", async () => {
    state.accounts = [account(1), account(2)];
    getAccessToken.mockRejectedValueOnce(new Error("expired")).mockResolvedValueOnce({ accessToken: "second" });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await reportAtlassianAccounts(now)).toEqual({ reported: 2, closed: 0 });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer second");

    state.reports = [];
    getAccessToken.mockReset();
    getAccessToken.mockRejectedValue(new Error("expired"));
    expect((await reportAtlassianAccounts(now)).error).toMatch(/No connected Atlassian account/);
  });
});
