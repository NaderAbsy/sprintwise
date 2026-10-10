import "server-only";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { withCriteriaInDescription } from "@/lib/stories/types";

/**
 * Jira Cloud through Atlassian's OAuth 2.0 (3LO). Tokens are stored by Better
 * Auth (encrypted, refreshed when they expire); this module only reads issues
 * and writes back the fields a person changed in Sprintwise. REST API v2 is used
 * because it returns text fields as Jira wiki markup, which Sprintwise already
 * shows and keeps.
 */

/** Pretend Jira for end-to-end tests: invented issues, writes kept in memory. Never on a Vercel deploy. */
export const jiraFake = process.env.JIRA_FAKE === "true";
if (jiraFake && process.env.VERCEL_ENV) {
  throw new Error("JIRA_FAKE must not be set on a Vercel deploy.");
}

export const jiraConfigured = jiraFake || Boolean(process.env.ATLASSIAN_CLIENT_ID && process.env.ATLASSIAN_CLIENT_SECRET);

export type JiraSite = { id: string; name: string; url: string };

export type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  storyPoints: number | null;
  status: string;
  issueType: string;
  parent: string;
  labels: string[];
  /** When the issue was created in Jira (ISO), so Sync can tell new issues from ones left out at import. */
  created: string | null;
};

/** The fields Sprintwise writes back: what was edited here. */
export type JiraUpdate = { summary: string; description: string; acceptanceCriteria: string; storyPoints: number | null };

export class JiraError extends Error {}

/** Jira's results come back 100 at a time; a backlog import reads at most this many. */
export const JIRA_MAX_ISSUES = 1000;
const API = "https://api.atlassian.com";

/**
 * The REST base for one Jira site. Site ids come from Atlassian and keys from
 * stories; both are checked so neither can change which endpoint a request
 * reaches with the user's token ("..", "/" and the like).
 */
function siteApi(cloudId: string): string {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(cloudId)) throw new JiraError("That Jira site isn't one Sprintwise can open.");
  return `${API}/ex/jira/${cloudId}/rest/api/2`;
}

/** Jira issue keys look like ABC-123. */
export const isJiraKey = (key: string) => /^[A-Za-z][A-Za-z0-9_]{0,49}-\d{1,12}$/.test(key);

// ---------------------------------------------------------------------------
// The pretend Jira (tests only)
// ---------------------------------------------------------------------------

const FAKE_SITE: JiraSite = { id: "fake-cloud-id", name: "Example Jira", url: "https://example.atlassian.net" };
const fakeIssues = new Map<string, JiraIssue>(
  [
    {
      key: "SHOP-1",
      summary: "Refund a payment",
      description: "h3. Context\nAs a support agent I want to refund a payment so that the customer gets their money back",
      acceptanceCriteria: "- Full and partial refunds\n- The customer gets an email",
      storyPoints: 3,
      status: "To Do",
      issueType: "Story",
      parent: "Refunds",
      labels: ["payments"],
      created: "2026-01-05T09:00:00.000Z",
    },
    {
      key: "SHOP-2",
      summary: "Refund total ignores the discount",
      description: "The refund page adds the discount back before refunding.",
      acceptanceCriteria: "",
      storyPoints: null,
      status: "To Do",
      issueType: "Bug",
      parent: "Refunds",
      labels: [],
      created: "2026-01-05T09:00:00.000Z",
    },
    {
      key: "SHOP-3",
      summary: "Export statements",
      description: "",
      acceptanceCriteria: "",
      storyPoints: 5,
      status: "In Progress",
      issueType: "Story",
      parent: "Statements",
      labels: ["finance"],
      created: "2026-01-05T09:00:00.000Z",
    },
    {
      key: "SHOP-4",
      summary: "Old checkout clean-up",
      description: "",
      acceptanceCriteria: "",
      storyPoints: 1,
      status: "Done",
      issueType: "Task",
      parent: "",
      labels: [],
      created: "2026-01-05T09:00:00.000Z",
    },
  ].map((issue) => [issue.key, issue]),
);

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/** The signed-in user's Atlassian account, if they connected one. */
export async function jiraAccount(userId: string) {
  if (jiraFake) return { id: "fake-account" };
  if (!jiraConfigured) return null;
  return db.account.findFirst({ where: { userId, providerId: "atlassian" }, select: { id: true } });
}

async function accessToken(userId: string): Promise<string> {
  if (jiraFake) return "fake-token";
  const account = await jiraAccount(userId);
  if (!account) throw new JiraError("Connect Jira first.");
  try {
    // By user id rather than the browser's session, so the nightly sync can use it too. Better Auth
    // refreshes an expired token and stores Atlassian's new refresh token.
    const { accessToken } = await auth.api.getAccessToken({ body: { accountId: account.id, userId } });
    if (!accessToken) throw new Error("no token");
    return accessToken;
  } catch {
    throw new JiraError("The Jira connection has expired. Connect Jira again.");
  }
}

async function call<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 401) throw new JiraError("Jira didn't accept the connection. Connect Jira again.");
  if (response.status === 403) throw new JiraError("Your Jira account isn't allowed to do that on this site.");
  if (response.status === 429) throw new JiraError("Jira is busy. Try again in a minute.");
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { errorMessages?: string[]; errors?: Record<string, string> } | null;
    const detail = [...(body?.errorMessages ?? []), ...Object.values(body?.errors ?? {})].join(" ").slice(0, 300);
    throw new JiraError(detail ? `Jira said: ${detail}` : `Jira returned an error (${response.status}).`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** The Jira sites the connected account can open. */
export async function jiraSites(userId: string): Promise<JiraSite[]> {
  if (jiraFake) return [FAKE_SITE];
  const token = await accessToken(userId);
  const sites = await call<{ id: string; name: string; url: string; scopes: string[] }[]>(token, `${API}/oauth/token/accessible-resources`);
  return sites.filter((s) => s.scopes.includes("read:jira-work")).map(({ id, name, url }) => ({ id, name, url }));
}

// ---------------------------------------------------------------------------
// Reading issues
// ---------------------------------------------------------------------------

type FieldIds = { storyPoints: string[]; acceptanceCriteria: string | null };

/** Story points and acceptance criteria are custom fields with site-specific ids, found by name. */
async function fieldIds(token: string, cloudId: string): Promise<FieldIds> {
  const fields = await call<{ id: string; name: string; custom: boolean; schema?: { type?: string } }[]>(
    token,
    `${siteApi(cloudId)}/field`,
  );
  const named = (pattern: RegExp) => fields.filter((f) => f.custom && pattern.test(f.name.trim()));
  return {
    storyPoints: named(/^story points?$|^story point estimate$/i).map((f) => f.id),
    acceptanceCriteria: named(/^acceptance criteria$/i).find((f) => f.schema?.type === "string")?.id ?? null,
  };
}

type RawIssue = { key: string; fields: Record<string, unknown> };
const text = (v: unknown) => (typeof v === "string" ? v : "");
const named = (v: unknown) => (v && typeof v === "object" && "name" in v ? text((v as { name: unknown }).name) : "");

function toIssue(raw: RawIssue, ids: FieldIds): JiraIssue {
  const f = raw.fields;
  const points = ids.storyPoints.map((id) => f[id]).find((v) => typeof v === "number");
  const parent = f.parent as { fields?: { summary?: unknown } } | undefined;
  return {
    key: raw.key,
    summary: text(f.summary),
    description: text(f.description),
    acceptanceCriteria: ids.acceptanceCriteria ? text(f[ids.acceptanceCriteria]) : "",
    storyPoints: typeof points === "number" ? points : null,
    status: named(f.status),
    issueType: named(f.issuetype),
    parent: text(parent?.fields?.summary),
    labels: Array.isArray(f.labels) ? f.labels.filter((l): l is string => typeof l === "string") : [],
    created: text(f.created) || null,
  };
}

/** Runs a JQL search and returns up to JIRA_MAX_ISSUES issues, in Jira's order. */
export async function searchJira(userId: string, cloudId: string, jql: string): Promise<{ issues: JiraIssue[]; truncated: boolean }> {
  if (jiraFake) {
    const issues = [...fakeIssues.values()];
    return { issues: /statusCategory\s*!=\s*Done/i.test(jql) ? issues.filter((i) => i.status !== "Done") : issues, truncated: false };
  }
  const token = await accessToken(userId);
  const ids = await fieldIds(token, cloudId);
  const fields = ["summary", "description", "status", "issuetype", "parent", "labels", "created", ...ids.storyPoints];
  if (ids.acceptanceCriteria) fields.push(ids.acceptanceCriteria);

  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await call<{ issues: RawIssue[]; nextPageToken?: string; isLast?: boolean }>(
      token,
      `${siteApi(cloudId)}/search/jql`,
      { method: "POST", body: JSON.stringify({ jql, fields, maxResults: 100, ...(nextPageToken && { nextPageToken }) }) },
    );
    issues.push(...page.issues.map((raw) => toIssue(raw, ids)));
    nextPageToken = page.isLast ? undefined : page.nextPageToken;
  } while (nextPageToken && issues.length < JIRA_MAX_ISSUES);
  return { issues: issues.slice(0, JIRA_MAX_ISSUES), truncated: issues.length >= JIRA_MAX_ISSUES && Boolean(nextPageToken) };
}

// ---------------------------------------------------------------------------
// Writing back
// ---------------------------------------------------------------------------

/**
 * Writes a story's edited fields to its Jira issue. Points and criteria go only
 * where the site has those fields; if the issue type's screen doesn't allow
 * them (often the case for bugs), the title and description are still sent and
 * the skipped fields are named.
 */
export async function updateJiraIssue(
  userId: string,
  cloudId: string,
  key: string,
  update: JiraUpdate,
): Promise<{ skipped: string[]; criteriaInDescription: boolean }> {
  if (jiraFake) {
    const issue = fakeIssues.get(key);
    if (!issue) throw new JiraError(`Jira has no issue ${key}.`);
    fakeIssues.set(key, { ...issue, ...update });
    return { skipped: [], criteriaInDescription: false };
  }
  if (!isJiraKey(key)) throw new JiraError(`${key.slice(0, 60)} isn't a Jira issue key, so it can't be sent.`);
  const token = await accessToken(userId);
  const ids = await fieldIds(token, cloudId);
  const url = `${siteApi(cloudId)}/issue/${encodeURIComponent(key)}?notifyUsers=false`;
  // With no criteria field on this site, criteria written here go into the description, where the team keeps them.
  const criteriaInDescription = !ids.acceptanceCriteria && update.acceptanceCriteria.trim() !== "";
  const description = criteriaInDescription ? withCriteriaInDescription(update.description, update.acceptanceCriteria) : update.description;
  const base: Record<string, unknown> = { summary: update.summary, description };
  const extra: Record<string, unknown> = {};
  if (ids.storyPoints[0]) extra[ids.storyPoints[0]] = update.storyPoints;
  if (ids.acceptanceCriteria) extra[ids.acceptanceCriteria] = update.acceptanceCriteria;
  try {
    await call<void>(token, url, { method: "PUT", body: JSON.stringify({ fields: { ...base, ...extra } }) });
    return { skipped: [], criteriaInDescription };
  } catch (error) {
    const notOnScreen = error instanceof JiraError && /cannot be set|not on the appropriate screen|unknown/i.test(error.message);
    if (!notOnScreen || Object.keys(extra).length === 0) throw error;
    await call<void>(token, url, { method: "PUT", body: JSON.stringify({ fields: base }) });
    const skipped = [ids.storyPoints[0] && "story points", ids.acceptanceCriteria && "acceptance criteria"].filter(Boolean) as string[];
    return { skipped, criteriaInDescription };
  }
}

// ---------------------------------------------------------------------------
// Into the import pipeline
// ---------------------------------------------------------------------------

const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/**
 * Jira issues as a CSV with Jira's own column names, so they go through exactly
 * the same preview, checks and import as a file would.
 */
export function issuesAsCsv(issues: JiraIssue[]): string {
  const labelColumns = Math.max(1, ...issues.map((i) => i.labels.length));
  const header = [
    "Issue key",
    "Summary",
    "Issue Type",
    "Description",
    "Acceptance Criteria",
    "Story Points",
    "Status",
    "Parent summary",
    ...Array.from({ length: labelColumns }, () => "Labels"),
  ];
  const rows = issues.map((i) =>
    [
      i.key,
      i.summary,
      i.issueType,
      i.description,
      i.acceptanceCriteria,
      i.storyPoints === null ? "" : String(i.storyPoints),
      i.status,
      i.parent,
      ...Array.from({ length: labelColumns }, (_, n) => i.labels[n] ?? ""),
    ]
      .map(cell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}
