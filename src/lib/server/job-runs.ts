import "server-only";
import { db } from "@/lib/server/db";

/** The nightly jobs, in the order the Insights page lists them. */
export const JOBS = {
  "atlassian-accounts": { label: "Atlassian report and clean-up", schedule: "03:00–04:00 UTC" },
  "jira-sync": { label: "Jira sync", schedule: "22:00–23:00 UTC" },
} as const;
export type JobName = keyof typeof JOBS;

/** Runs a job and keeps when it ran, whether it finished, and a one-line summary. A crash is kept too, then rethrown. */
export async function runJob<T>(name: JobName, job: () => Promise<T>, summarize: (result: T) => { ok: boolean; summary: string }): Promise<T> {
  const record = (ok: boolean, summary: string) =>
    db.jobRun
      .upsert({ where: { name }, create: { name, ranAt: new Date(), ok, summary }, update: { ranAt: new Date(), ok, summary } })
      .catch(() => undefined);
  try {
    const result = await job();
    const { ok, summary } = summarize(result);
    await record(ok, summary);
    return result;
  } catch (error) {
    await record(false, "Stopped with an error; see the Vercel logs within the hour.");
    throw error;
  }
}

/** Each job's last run, or null if it hasn't run yet. */
export async function lastRuns() {
  const rows = await db.jobRun.findMany();
  return (Object.keys(JOBS) as JobName[]).map((name) => ({ name, ...JOBS[name], run: rows.find((r) => r.name === name) ?? null }));
}
