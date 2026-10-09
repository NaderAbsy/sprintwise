// Prints the anonymous usage counts (story L-3).
// Usage: `pnpm usage` (reads DATABASE_URL from .env), or for production:
//   DATABASE_URL="<the Neon connection string>" pnpm usage
// usage_events holds only an event type and a timestamp: no user ids, no story text.
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}

// verify-full, as in src/lib/server/database-url.ts: the same check pg does today, without its warning.
const connectionString = process.env.DATABASE_URL.replace(/([?&]sslmode=)(?:require|prefer|verify-ca)(?=&|$)/i, "$1verify-full");
const client = new pg.Client({ connectionString });
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
