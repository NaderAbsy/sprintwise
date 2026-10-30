// Setup file for `pnpm test:db`, after dotenv has read .env: refuses a database that isn't local.
import { assertLocalDatabase } from "../../scripts/local-database.mjs";

assertLocalDatabase();
