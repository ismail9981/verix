import type { SQL } from "drizzle-orm";
import type { Executor } from "../db/executor";

/**
 * Runs a raw `sql` template against `exec` (either `db` or a transaction's
 * `tx`) and casts the result to `T[]` — the driver's raw execute result
 * isn't already typed as an array, so every raw-SQL aggregate query
 * (metrics, dashboard summaries) across the codebase goes through this one
 * cast rather than each re-deriving it.
 */
export async function rows<T>(exec: Executor, query: SQL): Promise<T[]> {
  const result = await exec.execute(query);
  return result as unknown as T[];
}

/** A raw SQL aggregate's numeric result arrives as `unknown` (driver-dependent numeric/string/bigint representation) — normalizes it to a plain `number`, treating a missing value as `0`. */
export const n = (value: unknown): number => Number(value ?? 0);
