// Prints the anonymous usage counts (story L-3).
// Usage: `pnpm usage` (reads DATABASE_URL from .env), or for production:
//   DATABASE_URL="<the Neon connection string>" pnpm usage
// usage_events holds only an event type and a timestamp: no user ids, no story text.
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(`
    SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, "eventType" AS event, count(*)::int AS count
    FROM usage_events
    GROUP BY 1, 2
    ORDER BY 1 DESC, 2`);
  const { rows: totals } = await client.query(`
    SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM projects) AS projects,
      (SELECT count(*)::int FROM stories) AS stories,
      (SELECT count(*)::int FROM sprints) AS sprints`);
  console.log("Totals now:", totals[0]);
  if (rows.length === 0) console.log("No usage events yet.");
  else console.table(rows);
} finally {
  await client.end();
}
