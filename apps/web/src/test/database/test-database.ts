import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  assertApprovedDatabaseTarget,
  assertNoHostedSupabaseProjectLink,
  ForbiddenDatabaseTargetError,
  type DatabaseTargetEnvironment,
} from "./database-target";

/**
 * Disposable PostgreSQL infrastructure for Sprint 1 integration tests.
 *
 * This module is deliberately independent from `src/server/env.ts` and
 * `src/server/db/db.ts`: database tests must use TEST_DATABASE_URL and must
 * never fall back to the application's DATABASE_URL.
 */

export interface TestDatabaseEnvironment extends DatabaseTargetEnvironment {
  VERIX_CANONICAL_ADOPTION?: string;
}

export interface SafeTestDatabaseConfig {
  /** Kept for the client factory; never include this value in errors or logs. */
  readonly connectionString: string;
  readonly host: string;
  readonly port: string;
  readonly database: string;
  readonly targetKind: "disposable_database" | "local_supabase";
}

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTestDatabaseError";
  }
}

function fail(message: string): never {
  throw new UnsafeTestDatabaseError(message);
}

/**
 * Validates every safety invariant before a test database connection is made.
 * Error messages are static and intentionally never interpolate credentials,
 * connection strings, usernames, or passwords.
 */
export function assertSafeTestDatabase(
  source: TestDatabaseEnvironment = process.env,
): SafeTestDatabaseConfig {
  const raw = source.TEST_DATABASE_URL?.trim();
  try {
    const target = assertApprovedDatabaseTarget(source);
    return {
      connectionString: raw!,
      host: target.host!,
      port: target.port!,
      database: target.database!,
      targetKind: target.targetKind!,
    };
  } catch (error) {
    if (error instanceof ForbiddenDatabaseTargetError) {
      throw new UnsafeTestDatabaseError(error.message);
    }
    throw error;
  }
}

export type TestDatabaseClient = ReturnType<typeof postgres>;
export type TestDatabaseClientFactory = (
  connectionString: string,
  options: Parameters<typeof postgres>[1],
) => TestDatabaseClient;

const REPOSITORY_ROOT = resolve(
  fileURLToPath(new URL("../../..", import.meta.url)),
  "../..",
);

/** Creates a lazy postgres.js client only after all safety guards pass. */
export function createTestDatabaseClient(
  source: TestDatabaseEnvironment = process.env,
  clientFactory: TestDatabaseClientFactory = postgres,
  repositoryRoot = REPOSITORY_ROOT,
): { client: TestDatabaseClient; config: SafeTestDatabaseConfig } {
  const config = assertSafeTestDatabase(source);
  assertNoHostedSupabaseProjectLink(repositoryRoot);
  const client = clientFactory(config.connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 5,
  });
  return { client, config };
}

/**
 * Safe connection lifecycle for later B2/B3 suites. postgres.js connects
 * lazily, and the client is always closed after the callback.
 */
export async function withTestDatabase<T>(
  operation: (
    client: TestDatabaseClient,
    config: SafeTestDatabaseConfig,
  ) => Promise<T>,
  source: TestDatabaseEnvironment = process.env,
): Promise<T> {
  const { client, config } = createTestDatabaseClient(source);
  try {
    return await operation(client, config);
  } finally {
    await client.end({ timeout: 1 });
  }
}

/**
 * The only entry point future reset/drop/recreate helpers may use.
 * The central assertion runs before a client exists and before the destructive
 * callback can execute. B1 intentionally provides no destructive SQL.
 */
export async function runGuardedDestructiveTestDatabaseOperation<T>(
  operation: (
    client: TestDatabaseClient,
    config: SafeTestDatabaseConfig,
  ) => Promise<T>,
  source: TestDatabaseEnvironment = process.env,
): Promise<T> {
  const config = assertSafeTestDatabase(source);
  if (config.targetKind === "local_supabase") {
    return fail(
      "Generic destructive database operations are disabled for local Supabase.",
    );
  }
  return withTestDatabase(operation, source);
}
