import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

/*
 * Drizzle ORM database client.
 *
 * A single postgres.js connection pool is created from the validated
 * `DATABASE_URL`. `prepare: false` is required behind Supabase's transaction
 * pooler (pgBouncer), which does not support prepared statements.
 *
 * Pool sizing: on serverless (Vercel) every instance opens its own pool, so we
 * cap it at 1 connection to avoid exhausting the shared Supabase pooler; on a
 * long-lived server we allow a larger pool. Override with `DB_POOL_MAX`. Idle
 * connections are reaped and connections have a bounded lifetime so the pooler
 * can rebalance.
 */

const isServerless = Boolean(process.env.VERCEL);
const poolMax = Number(process.env.DB_POOL_MAX ?? (isServerless ? 1 : 10));

const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
  idle_timeout: 20, // seconds an idle connection is kept before closing
  connect_timeout: 10, // seconds to wait for a new connection
  max_lifetime: 60 * 30, // recycle connections after 30 minutes
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
