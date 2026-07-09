import { defineConfig } from "drizzle-kit";
import { env } from "./src/server/env";

/*
 * Drizzle Kit configuration.
 *
 * Used by the `db:*` scripts to generate SQL migrations from the schema and
 * apply them to the database. The connection string is read through the same
 * validated `env` module the runtime uses, so config and app stay in sync.
 * Generated migrations land in `./drizzle`.
 */

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
