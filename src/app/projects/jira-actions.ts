"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { db } from "@/lib/server/db";
import { isId, requireFreshUser, requireProject, requireUser } from "@/lib/server/dal";
import { issuesAsCsv, JIRA_TITLE_MAX, JiraBusyError, JiraError, jiraSites, jiraWriter, searchJira, sendStoryToJira, type JiraWriter } from "@/lib/server/jira";
import { FIELD_NAMES, JIRA_FIELDS, readBase, sameField, type JiraField } from "@/lib/stories/jira-merge";
import { toStory } from "@/lib/server/readiness";
import { overLimit } from "@/lib/server/action-limits";
import { JQL_MAX } from "@/lib/limits";
import { jiraFailure, otherSite, syncProjectFromJira } from "@/lib/server/jira-sync";

const SEND_MAX = 50;
const SEND_BUDGET_MS = 40_000;

const failure = jiraFailure;

/**
 * Runs the search on the chosen Jira site and hands the issues to the import
 * preview as a CSV, so they get the same checks, filters and ticks as a file.
 * Nothing is saved: the site and search become the project's (for Sync and Send)
 * only when the issues are imported, so a preview never changes where Send writes.
 */
export async function previewFromJira(
  projectId: string,
  cloudId: string,
  jql: string,
): Promise<{ csv: string; count: number; truncated: boolean; searchedAt: string; cloudId: string; jql: string } | { error: string }> {
  const project = await requireProject(projectId);
  const user = await requireUser();
  const search = String(jql ?? "").trim();
  if (search === "") return { error: "Write a Jira search (JQL), for example: project = ABC AND statusCategory != Done ORDER BY Rank ASC" };
  if (search.length > JQL_MAX) return { error: `Keep the search under ${JQL_MAX} characters.` };
  const limited = await overLimit("jira", user.id);
  if (limited) return { error: limited };
  try {
    const site = (await jiraSites(user.id)).find((s) => s.id === cloudId);
    if (!site) return { error: "Choose one of your Jira sites." };
    const other = otherSite(project, site.id);
    if (other) return { error: other };
    const searchedAt = new Date().toISOString();
    const { issues, truncated } = await searchJira(user.id, site.id, search);
    if (issues.length === 0) return { error: "That search found no issues in Jira." };
    return { csv: issuesAsCsv(issues), count: issues.length, truncated, searchedAt, cloudId: site.id, jql: search };
  } catch (error) {
    return { error: failure(error) };
  }
}

/** Sync from Jira, clicked on the backlog. */
export async function syncFromJira(projectId: string): Promise<FormState> {
  const user = await requireFreshUser();
  const project = await requireProject(projectId);
  const limited = await overLimit("jira", user.id);
  if (limited) return { error: limited };
  const result = await syncProjectFromJira(project, user.id);
  if (result.message) revalidatePath(`/projects/${project.id}`, "layout");
  return result;
}

const list = (fields: JiraField[]) => {
  const names = fields.map((f) => FIELD_NAMES[f]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
};

/**
 * Writes stories edited here back to their Jira issues: only the fields edited
 * here (title, description, acceptance criteria, points), after checking Jira
 * hasn't changed the same field meanwhile. A story whose edits all landed is no
 * longer "edited here"; one with an edit Jira couldn't take stays edited, so the
 * next Sync doesn't overwrite it.
 */
export async function sendToJira(projectId: string, storyIds: string[]): Promise<FormState> {
  const user = await requireFreshUser();
  const project = await requireProject(projectId);
  if (!project.jiraCloudId) return { error: "Import from Jira once first, so Sprintwise knows which Jira site to write to." };
  const limited = await overLimit("jira", user.id);
  if (limited) return { error: limited };
  const ids = [...new Set((Array.isArray(storyIds) ? storyIds : []).filter(isId))].slice(0, SEND_MAX);
  const stories = await db.story.findMany({
    where: { projectId: project.id, id: { in: ids }, editedAt: { not: null } },
    orderBy: [{ rank: "asc" }, { key: "asc" }],
  });
  if (stories.length === 0) return { error: "There's nothing edited here to send." };

  const sent: string[] = [];
  const notes: string[] = [];
  let writer: JiraWriter;
  try {
    writer = await jiraWriter(user.id, project.jiraCloudId);
  } catch (error) {
    return { error: failure(error) };
  }
  // A slow Jira mustn't keep the page waiting for minutes: after this long, the rest wait for the next click.
  const deadline = Date.now() + SEND_BUDGET_MS;
  const unsent: string[] = [];
  for (const story of stories) {
    if (Date.now() > deadline) {
      unsent.push(story.key);
      continue;
    }
    try {
      const here = toStory(story);
      const result = await sendStoryToJira(user.id, project.jiraCloudId, here, readBase(story.jiraBase), writer);
      const done = JIRA_FIELDS.every((f) => sameField(f, here, result.base));
      await db.story.updateMany({ where: { id: story.id, projectId: project.id }, data: { jiraBase: result.base } });
      // Only if it wasn't edited again meanwhile: that newer edit still needs sending.
      if (done) await db.story.updateMany({ where: { id: story.id, editedAt: story.editedAt }, data: { editedAt: null } });
      if (result.sent.length > 0) sent.push(story.key);
      else if (done) notes.push(`${story.key}: Jira already had these changes.`);
      if (result.criteriaInDescription) notes.push(`${story.key}: this Jira has no acceptance criteria field here, so the criteria went into the description.`);
      if (result.conflicts.length > 0)
        notes.push(
          `${story.key}: the ${list(result.conflicts)} also changed in Jira since Sprintwise last read ${story.key}, so ${result.conflicts.length === 1 ? "it wasn't" : "they weren't"} sent (that would overwrite the change in Jira). Copy your version into Jira from the story page, then click Mark as copied.`,
        );
      if (result.notAllowed.length > 0)
        notes.push(`${story.key}: Jira doesn't allow ${list(result.notAllowed)} on this issue type, so ${result.notAllowed.length === 1 ? "it wasn't" : "they weren't"} sent. It stays edited here, so Sync won't overwrite it.`);
      if (result.tooLong.length > 0)
        notes.push(
          `${story.key}: the ${list(result.tooLong)} wasn't sent: ${
            result.tooLong.includes("title") && story.title.length > JIRA_TITLE_MAX
              ? `Jira titles can be at most ${JIRA_TITLE_MAX} characters.`
              : "its Jira text is longer than Sprintwise keeps, so sending it would cut it short. Edit it in Jira instead."
          }`,
        );
    } catch (error) {
      notes.push(`${story.key}: ${error instanceof JiraError && /does not exist|no issue|404/i.test(error.message) ? "isn't in Jira (written here?)." : failure(error)}`);
      // Connection problems apply to every story, and a busy Jira asked to wait; stop at the first.
      if (error instanceof JiraBusyError || (error instanceof JiraError && /connect jira/i.test(error.message))) {
        unsent.push(...stories.slice(stories.indexOf(story) + 1).map((s) => s.key));
        break;
      }
    }
  }
  if (unsent.length > 0) notes.push(`Not sent yet: ${unsent.join(", ")}. Click Send to Jira again for ${unsent.length === 1 ? "it" : "them"}.`);
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
