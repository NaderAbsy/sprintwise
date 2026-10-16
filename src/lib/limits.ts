/** Limits from the requirements doc's non-functional requirements ("suggested" values). */
export const MAX_PROJECTS = 10;
/** Caps that keep one account from filling the database or slowing a re-score. */
export const MAX_STORIES_PER_PROJECT = 1000;
export const MAX_SPRINTS_PER_PROJECT = 50;
export const MAX_SNAPSHOTS_PER_SPRINT = 30;
/**
 * Stories kept across all of an account's sprint snapshots. A busy team (26 sprints a
 * year, a snapshot most days, 60 stories) stores about 20,000 a year; this stops one
 * account from filling the database with millions.
 */
export const MAX_SNAPSHOT_ITEMS_PER_ACCOUNT = 100_000;
/**
 * The text those copies may add up to (titles, descriptions and criteria). The same busy
 * team stores about 20 MB a year; without this, copies of long stories could pass the
 * story count's intent many times over.
 */
export const MAX_SNAPSHOT_BYTES_PER_ACCOUNT = 50 * 1024 * 1024;
