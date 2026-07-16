import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

/**
 * Either the top-level `db` client or a `db.transaction(async (tx) => ...)`
 * callback's `tx`. Functions that may run inside a caller's transaction take
 * this type instead of hardcoding `db`, so a query never accidentally escapes
 * the transaction it's meant to be part of.
 */
export type Executor = PgDatabase<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
