import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests against a real Postgres (DATABASE_URL, from .env locally): `pnpm test:db`, after migrations.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.db.test.ts"],
    setupFiles: ["dotenv/config", "./src/test/local-database.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
