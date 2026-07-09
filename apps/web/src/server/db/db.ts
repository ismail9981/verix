import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

/*
 * Drizzle ORM database client.
 *
 * A single postgres.js connection pool is created from the validated
 * `DATABASE_URL`. `prepare: false` is recommended when connecting through
 * Supabase's transaction-mode pooler (pgBouncer), which does not support
 * prepared statements. The Drizzle instance is typed against the full schema
 * so queries get end-to-end type safety.
 */

const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });

export type Database = typeof db;
