import { normalizeKey, splitCriteria, type Story } from "@/lib/stories/types";

export type ChangeType =
  | "added"
  | "removed"
  | "re-estimated"
  | "criteria-changed"
  | "status-changed"
  | "renamed";

export type Change = {
  key: string;
  type: ChangeType;
  oldValue: string | null;
  newValue: string | null;
  /** Effect on the sprint's total points; 0 for changes that don't move scope. */
  pointsDelta: number;
};

const points = (story: Story) => story.storyPoints ?? 0;
const pointsText = (story: Story) => (story.storyPoints === null ? null : String(story.storyPoints));
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function indexByKey(stories: Story[]): Map<string, Story> {
  return new Map(stories.map((story) => [normalizeKey(story.key), story]));
}

/**
 * Lists what changed between two snapshots. Stories are matched by key only,
 * so a renamed story is one "renamed" change, never a removal plus an addition.
 * Order: removed and changed stories in `from` order, then added stories in `to` order.
 */
export function diffSnapshots(from: Story[], to: Story[]): Change[] {
  const before = indexByKey(from);
  const after = indexByKey(to);
  const changes: Change[] = [];

  for (const [key, old] of before) {
    const next = after.get(key);
    if (!next) {
      changes.push({ key, type: "removed", oldValue: pointsText(old), newValue: null, pointsDelta: -points(old) });
      continue;
    }
    if (old.storyPoints !== next.storyPoints) {
      changes.push({
        key,
        type: "re-estimated",
        oldValue: pointsText(old),
        newValue: pointsText(next),
        pointsDelta: points(next) - points(old),
      });
    }
    const oldCriteria = splitCriteria(old.acceptanceCriteria).join("\n");
    const newCriteria = splitCriteria(next.acceptanceCriteria).join("\n");
    if (oldCriteria !== newCriteria) {
      changes.push({ key, type: "criteria-changed", oldValue: oldCriteria, newValue: newCriteria, pointsDelta: 0 });
    }
    if (!sameText(old.status, next.status)) {
      changes.push({ key, type: "status-changed", oldValue: old.status, newValue: next.status, pointsDelta: 0 });
    }
    if (old.title.trim() !== next.title.trim()) {
      changes.push({ key, type: "renamed", oldValue: old.title, newValue: next.title, pointsDelta: 0 });
    }
  }

  for (const [key, next] of after) {
    if (!before.has(key)) {
      changes.push({ key, type: "added", oldValue: null, newValue: pointsText(next), pointsDelta: points(next) });
    }
  }

  return changes;
}
