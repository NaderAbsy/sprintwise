import "server-only";
import { MAX_SNAPSHOTS_PER_SPRINT } from "@/lib/limits";
import { db } from "@/lib/server/db";
import { toStory } from "@/lib/server/readiness";
import { carryReasons, planTracking, utcToday } from "@/lib/sprint/tracking";

/**
 * Records backlog edits in every sprint of the project that follows the
 * backlog, so nobody has to remember to save a snapshot. Call it after any
 * change to stories; it does nothing when no tracked sprint is affected.
 * Callers check ownership first.
 */
export async function recordSprintChanges(projectId: string, today = utcToday()) {
  const dayBefore = new Date(today.getTime() - 86_400_000);
  const sprints = await db.sprint.findMany({
    where: { projectId, tracksBacklog: true, endDate: { gte: dayBefore } },
    select: { id: true },
  });
  for (const { id } of sprints) await recordSprint(projectId, id, today);
}

async function recordSprint(projectId: string, sprintId: string, today: Date) {
  await db.$transaction(async (tx) => {
    // One edit at a time per sprint, so two quick edits can't both create today's snapshot.
    await tx.$queryRaw`SELECT id FROM sprints WHERE id = ${sprintId} FOR UPDATE`;
    const sprint = await tx.sprint.findUnique({
      where: { id: sprintId },
      select: {
        endDate: true,
        _count: { select: { snapshots: true } },
        snapshots: {
          orderBy: [{ asOfDate: "desc" }, { uploadedAt: "desc" }],
          take: 2,
          include: { items: true },
        },
      },
    });
    if (!sprint) return;
    const [latestRow, previousRow] = sprint.snapshots;
    if (!latestRow) return;
    const asTracked = (row: typeof latestRow) => ({ ...row, items: row.items.map(toStory) });

    const backlog = await tx.story.findMany({
      where: { projectId, key: { in: latestRow.items.map((i) => i.key) } },
    });
    const plan = planTracking({
      sprint,
      latest: asTracked(latestRow),
      previous: previousRow && asTracked(previousRow),
      backlog: backlog.map(toStory),
      today,
    });

    const changeRows = (changes: { key: string; type: string; oldValue: string | null; newValue: string | null; pointsDelta: number; reason?: string | null }[], fromId: string, toId: string) =>
      changes.map((c) => ({
        sprintId,
        fromSnapshotId: fromId,
        toSnapshotId: toId,
        key: c.key,
        changeType: c.type,
        oldValue: c.oldValue,
        newValue: c.newValue,
        pointsDelta: c.pointsDelta,
        reason: c.reason ?? null,
      }));

    switch (plan.kind) {
      case "none":
        return;
      case "create": {
        // At the cap, edits stop being recorded rather than overwrite history.
        if (sprint._count.snapshots >= MAX_SNAPSHOTS_PER_SPRINT) return;
        const snapshot = await tx.snapshot.create({
          data: { sprintId, asOfDate: plan.asOfDate, locked: true, auto: true, items: { create: plan.items } },
        });
        await tx.change.createMany({ data: changeRows(plan.changes, latestRow.id, snapshot.id) });
        return;
      }
      case "replace": {
        const old = await tx.change.findMany({ where: { toSnapshotId: plan.snapshotId } });
        await tx.change.deleteMany({ where: { toSnapshotId: plan.snapshotId } });
        await tx.snapshotItem.deleteMany({ where: { snapshotId: plan.snapshotId } });
        await tx.snapshotItem.createMany({ data: plan.items.map((item) => ({ ...item, snapshotId: plan.snapshotId })) });
        await tx.change.createMany({ data: changeRows(carryReasons(plan.changes, old), previousRow!.id, plan.snapshotId) });
        return;
      }
      case "delete":
        await tx.snapshot.delete({ where: { id: plan.snapshotId } });
        return;
    }
  });
}
