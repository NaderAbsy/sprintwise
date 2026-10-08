"use server";

import { revalidatePath } from "next/cache";
import { readCsvTable } from "@/lib/csv/parse";
import type { FormState } from "@/lib/form-state";
import { MAX_STORIES_PER_PROJECT } from "@/lib/limits";
import { db } from "@/lib/server/db";
import { isId, requireFreshUser, requireProject, requireUser } from "@/lib/server/dal";
import { issuesAsCsv, JIRA_MAX_ISSUES, JiraError, jiraSites, searchJira, updateJiraIssue } from "@/lib/server/jira";
import { saveStories } from "@/lib/server/save-stories";
import { doneStatusesOf } from "@/lib/server/sprint";
import { recordSprintChanges } from "@/lib/server/tracking";
import { isDone } from "@/lib/sprint/metrics";

const JQL_MAX = 2000;
const SEND_MAX = 50;

const failure = (error: unknown) =>
  error instanceof JiraError ? error.message : "Couldn't reach Jira. Check your connection and try again.";

/**
 * Runs the search on the chosen Jira site and hands the issues to the import
 * preview as a CSV, so they get the same checks, filters and ticks as a file.
 * The site and search are saved on the project for Sync.
 */
export async function previewFromJira(
  projectId: string,
  cloudId: string,
  jql: string,
): Promise<{ csv: string; count: number; truncated: boolean } | { error: string }> {
  const project = await requireProject(projectId);
  const user = await requireUser();
  const search = String(jql ?? "").trim();
  if (search === "") return { error: "Write a Jira search (JQL), for example: project = ABC AND statusCategory != Done ORDER BY Rank ASC" };
  if (search.length > JQL_MAX) return { error: `Keep the search under ${JQL_MAX} characters.` };
  try {
    const site = (await jiraSites(user.id)).find((s) => s.id === cloudId);
    if (!site) return { error: "Choose one of your Jira sites." };
    const { issues, truncated } = await searchJira(user.id, site.id, search);
    await db.project.update({
      where: { id: project.id },
      data: { jiraCloudId: site.id, jiraSiteName: site.name, jiraSiteUrl: site.url, jiraJql: search },
    });
    if (issues.length === 0) return { error: "That search found no issues in Jira." };
    return { csv: issuesAsCsv(issues), count: issues.length, truncated };
  } catch (error) {
    return { error: failure(error) };
  }
}

/**
 * Runs the project's saved search again: updates stories that came from Jira and
 * adds new ones. Stories edited here and not yet sent to Jira are left alone, and
 * new issues that are already finished aren't added.
 */
export async function syncFromJira(projectId: string): Promise<FormState> {
  const user = await requireFreshUser();
  const project = await requireProject(projectId);
  if (!project.jiraCloudId || !project.jiraJql) return { error: "Import from Jira once first, so Sprintwise knows which search to run." };

  let csv: string;
  let created: Map<string, string | null>;
  try {
    const { issues } = await searchJira(user.id, project.jiraCloudId, project.jiraJql);
    csv = issuesAsCsv(issues);
    created = new Map(issues.map((i) => [i.key.trim().toUpperCase(), i.created]));
  } catch (error) {
    return { error: failure(error) };
  }
  // New issues are ones created since the last import or sync; older ones missing here were left out on purpose.
  const since = project.jiraSyncedAt;
  const isNew = (key: string) => {
    const at = created.get(key);
    return !since || !at || new Date(at) > since;
  };
  const table = readCsvTable(csv, { maxBytes: Number.MAX_SAFE_INTEGER, maxRows: JIRA_MAX_ISSUES });
  if (!table.ok) return { error: table.errors[0]?.message ?? "Jira's issues couldn't be read." };

  const existing = new Map(
    (await db.story.findMany({ where: { projectId: project.id }, select: { key: true, editedAt: true } })).map((s) => [s.key, s]),
  );
  const doneStatuses = doneStatusesOf(project);
  let kept = 0;
  let problems = 0;
  let leftOut = 0;
  const stories = table.rows.flatMap((row) => {
    if (row.errors.length > 0) {
      problems++;
      return [];
    }
    const current = existing.get(row.story.key);
    if (current?.editedAt) {
      kept++;
      return [];
    }
    if (!current && isDone(row.story.status, doneStatuses)) return [];
    if (!current && !isNew(row.story.key)) {
      leftOut++;
      return [];
    }
    return [{ ...row.story, epic: row.epic, issueType: row.story.issueType ?? "" }];
  });
  const added = stories.filter((s) => !existing.has(s.key)).length;
  if (existing.size + added > MAX_STORIES_PER_PROJECT) {
    return { error: `Syncing would take the project past ${MAX_STORIES_PER_PROJECT} stories. Narrow the Jira search on the Import page.` };
  }

  await saveStories(project, stories, [db.project.update({ where: { id: project.id }, data: { jiraSyncedAt: new Date() } })]);
  await recordSprintChanges(project.id);
  revalidatePath(`/projects/${project.id}`, "layout");
  const parts = [`Synced from Jira: ${stories.length - added} updated, ${added} added.`];
  if (kept > 0) parts.push(`${kept} edited here ${kept === 1 ? "was" : "were"} left as ${kept === 1 ? "it is" : "they are"}; send ${kept === 1 ? "it" : "them"} to Jira first.`);
  if (problems > 0) parts.push(`${problems} couldn't be read (for example, no title).`);
  if (leftOut > 0) parts.push(`${leftOut} left out at import ${leftOut === 1 ? "wasn't" : "weren't"} added; import ${leftOut === 1 ? "it" : "them"} from the Import page if you want ${leftOut === 1 ? "it" : "them"}.`);
  return { message: parts.join(" ") };
}

/**
 * Writes stories edited here back to their Jira issues: title, description,
 * acceptance criteria and points. Each one that lands is no longer "edited here".
 */
export async function sendToJira(projectId: string, storyIds: string[]): Promise<FormState> {
  const user = await requireFreshUser();
  const project = await requireProject(projectId);
  if (!project.jiraCloudId) return { error: "Import from Jira once first, so Sprintwise knows which Jira site to write to." };
  const ids = [...new Set((Array.isArray(storyIds) ? storyIds : []).filter(isId))].slice(0, SEND_MAX);
  const stories = await db.story.findMany({
    where: { projectId: project.id, id: { in: ids }, editedAt: { not: null } },
    orderBy: [{ rank: "asc" }, { key: "asc" }],
  });
  if (stories.length === 0) return { error: "There's nothing edited here to send." };

  const sent: string[] = [];
  const notes: string[] = [];
  for (const story of stories) {
    try {
      const { skipped, criteriaInDescription } = await updateJiraIssue(user.id, project.jiraCloudId, story.key, {
        summary: story.title,
        description: story.description,
        acceptanceCriteria: story.acceptanceCriteria,
        storyPoints: story.storyPoints,
      });
      await db.story.update({ where: { id: story.id }, data: { editedAt: null } });
      sent.push(story.key);
      if (criteriaInDescription) notes.push(`${story.key}: this Jira has no acceptance criteria field, so the criteria went into the description.`);
      if (skipped.length > 0) notes.push(`${story.key}: Jira doesn't allow ${skipped.join(" or ")} on this issue type, so ${skipped.length === 1 ? "it wasn't" : "they weren't"} sent.`);
    } catch (error) {
      notes.push(`${story.key}: ${error instanceof JiraError && /does not exist|no issue/i.test(error.message) ? "isn't in Jira (written here?)." : failure(error)}`);
      // Connection problems apply to every story; stop at the first.
      if (error instanceof JiraError && /connect jira/i.test(error.message)) break;
    }
  }
  revalidatePath(`/projects/${project.id}`, "layout");
  const text = [sent.length > 0 ? `Sent ${sent.length} to Jira: ${sent.join(", ")}.` : "Nothing was sent.", ...notes].join(" ");
  return sent.length > 0 ? { message: text } : { error: text };
}

/** Removes the Jira connection from the account: the stored tokens are deleted. Projects keep their saved search. */
export async function disconnectJira() {
  const user = await requireUser();
  await db.account.deleteMany({ where: { userId: user.id, providerId: "atlassian" } });
  revalidatePath("/projects", "layout");
  revalidatePath("/account");
}
