/** Backlog priority order: fractional ranks, so moving a story changes only that story. */

/** Smallest gap between neighbours before the whole backlog is renumbered. */
const MIN_GAP = 1e-6;

export type RankedStory = { id: string; rank: number };

/**
 * Where a story lands when moved to `index` (0 = top) in the backlog's priority
 * order. Returns the new rank for the moved story, or a full renumbering
 * when neighbours have grown too close together.
 */
export function planMove(
  ordered: RankedStory[],
  storyId: string,
  index: number,
): { kind: "none" } | { kind: "rank"; rank: number } | { kind: "renumber"; ids: string[] } {
  const from = ordered.findIndex((s) => s.id === storyId);
  if (from < 0) return { kind: "none" };
  const others = ordered.filter((s) => s.id !== storyId);
  const to = Math.max(0, Math.min(Math.trunc(index), others.length));
  if (to === from) return { kind: "none" };

  const before = others[to - 1]?.rank;
  const after = others[to]?.rank;
  if (before !== undefined && after !== undefined && after - before < MIN_GAP) {
    const ids = others.map((s) => s.id);
    ids.splice(to, 0, storyId);
    return { kind: "renumber", ids };
  }
  const rank = before === undefined ? (after === undefined ? 1 : after - 1) : after === undefined ? before + 1 : (before + after) / 2;
  return { kind: "rank", rank };
}
