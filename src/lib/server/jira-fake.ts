import "server-only";
import type { JiraIssue, JiraSite } from "@/lib/server/jira";

/**
 * Pretend Jira for end-to-end tests: invented issues, kept in memory per user so
 * tests running side by side don't see each other's changes. Only used when
 * JIRA_FAKE is set, which jira.ts refuses on any Vercel deploy.
 */

export const FAKE_SITE: JiraSite = { id: "fake-cloud-id", name: "Example Jira", url: "https://example.atlassian.net" };

const STARTING_ISSUES: JiraIssue[] = [
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
];

// On globalThis: route handlers and server actions are bundled apart, and each bundle would otherwise get
// its own copy of this module, so a test's change "in Jira" wouldn't reach Sync.
const store = globalThis as typeof globalThis & { sprintwiseFakeJira?: Map<string, Map<string, JiraIssue>> };
const byUser = (store.sprintwiseFakeJira ??= new Map());

function issuesOf(userId: string): Map<string, JiraIssue> {
  let issues = byUser.get(userId);
  if (!issues) {
    issues = new Map(STARTING_ISSUES.map((issue) => [issue.key, structuredClone(issue)]));
    byUser.set(userId, issues);
  }
  return issues;
}

/** The handful of JQL the tests use: everything, not finished, or a list of keys. */
export function fakeSearch(userId: string, jql: string): JiraIssue[] {
  const all = [...issuesOf(userId).values()];
  const keys = /key\s+in\s*\(([^)]*)\)/i.exec(jql);
  if (keys) {
    const wanted = new Set(keys[1].split(",").map((k) => k.trim().toUpperCase()));
    return all.filter((i) => wanted.has(i.key));
  }
  return /statusCategory\s*!=\s*Done/i.test(jql) ? all.filter((i) => i.status !== "Done") : all;
}

export function fakeIssue(userId: string, key: string): JiraIssue | undefined {
  return issuesOf(userId).get(key);
}

/** A change made "in Jira": by Send, or by a test acting as a teammate. */
export function fakeChange(userId: string, key: string, change: Partial<Omit<JiraIssue, "key">>): JiraIssue | undefined {
  const issue = issuesOf(userId).get(key);
  if (!issue) return undefined;
  const next = { ...issue, ...change };
  issuesOf(userId).set(key, next);
  return next;
}

export function fakeAdd(userId: string, issue: JiraIssue) {
  issuesOf(userId).set(issue.key, issue);
}
