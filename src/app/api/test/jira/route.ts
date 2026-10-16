import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/server/auth";
import { jiraFake } from "@/lib/server/jira";
import { fakeAdd, fakeChange } from "@/lib/server/jira-fake";

/**
 * End-to-end tests only: a teammate's change "in Jira", made to the signed-in
 * user's pretend Jira. Not found unless JIRA_FAKE is on, which jira.ts refuses
 * on any Vercel deploy.
 */
export async function POST(request: NextRequest) {
  if (!jiraFake) return new NextResponse(null, { status: 404 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new NextResponse(null, { status: 401 });
  const body = (await request.json().catch(() => null)) as { key?: unknown; change?: Record<string, unknown>; add?: boolean } | null;
  if (!body || typeof body.key !== "string") return NextResponse.json({ error: "key" }, { status: 400 });
  if (body.add) {
    fakeAdd(session.user.id, {
      key: body.key,
      summary: "",
      description: "",
      acceptanceCriteria: "",
      storyPoints: null,
      status: "To Do",
      issueType: "Story",
      parent: "",
      labels: [],
      created: new Date().toISOString(),
      ...body.change,
    });
    return NextResponse.json({ ok: true });
  }
  const issue = fakeChange(session.user.id, body.key, body.change ?? {});
  return issue ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "no issue" }, { status: 404 });
}
