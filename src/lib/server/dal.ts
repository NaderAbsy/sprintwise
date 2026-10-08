import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const ID = /^[a-z0-9_-]{1,64}$/i;

/** Whether a value is a plain id. Server action arguments arrive from the browser, so their types aren't guaranteed. */
export function isId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

/** 404 unless the value is a plain id: an object such as {"not": ""} must never reach a Prisma filter. */
export function assertId(value: unknown): asserts value is string {
  if (!isId(value)) notFound();
}

/**
 * Data access layer. Every page and server action goes through these, so each
 * read and write checks sign-in and ownership (proxy.ts is only an optimistic redirect).
 */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/");
  return { id: session.user.id, name: session.user.name, email: session.user.email };
});

/**
 * The signed-in user, checked against the database rather than the five-minute
 * cookie copy, for actions that can't be undone or that act in Jira: a session
 * signed out elsewhere stops working for these at once.
 */
export const requireFreshUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  if (!session) redirect("/");
  return { id: session.user.id, name: session.user.name, email: session.user.email };
});

/** The project if the signed-in user owns it; 404 otherwise, so ids can't be probed. */
export const requireProject = cache(async (projectId: string) => {
  const user = await requireUser();
  assertId(projectId);
  const project = await db.project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!project) notFound();
  return project;
});

export const requireSprint = cache(async (projectId: string, sprintId: string) => {
  const project = await requireProject(projectId);
  assertId(sprintId);
  const sprint = await db.sprint.findFirst({ where: { id: sprintId, projectId: project.id } });
  if (!sprint) notFound();
  return { project, sprint };
});
