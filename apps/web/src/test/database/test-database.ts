import postgres from "postgres";

/**
 * Disposable PostgreSQL infrastructure for Sprint 1 integration tests.
 *
 * This module is deliberately independent from `src/server/env.ts` and
 * `src/server/db/db.ts`: database tests must use TEST_DATABASE_URL and must
 * never fall back to the application's DATABASE_URL.
 */

const TEST_DATABASE_MARKER = "verix_test";
const LOCAL_TEST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);
const UNSAFE_DATABASE_NAMES = new Set([
  "postgres",
  "template0",
  "template1",
  "verix",
  "prod",
  "production",
]);

const PRODUCTION_LIKE_HOST_PATTERNS = [
  /(^|[.-])prod(?:uction)?([.-]|$)/i,
  /(^|\.)supabase\.(?:co|com)$/i,
  /(^|\.)neon\.tech$/i,
  /(^|\.)amazonaws\.com$/i,
  /(^|\.)database\.azure\.com$/i,
  /(^|\.)render\.com$/i,
  /(^|[.-])pooler([.-]|$)/i,
];

export interface TestDatabaseEnvironment {
  NODE_ENV?: string;
  VERIX_TEST_DATABASE?: string;
  TEST_DATABASE_URL?: string;
  TEST_DATABASE_ALLOWED_HOSTS?: string;
  VERIX_LOCAL_SUPABASE?: string;
  DATABASE_URL?: string;
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

function allowedHosts(source: TestDatabaseEnvironment): Set<string> {
  const hosts = new Set(LOCAL_TEST_HOSTS);
  for (const value of source.TEST_DATABASE_ALLOWED_HOSTS?.split(",") ?? []) {
    const host = value.trim().toLowerCase();
    if (host) hosts.add(host);
  }
  return hosts;
}

function databaseName(url: URL): string {
  const encoded = url.pathname.replace(/^\/+/, "");
  if (!encoded || encoded.includes("/")) {
    return fail("TEST_DATABASE_URL must identify one test database.");
  }
  try {
    return decodeURIComponent(encoded);
  } catch {
    return fail("TEST_DATABASE_URL contains an invalid database name.");
  }
}

/**
 * Validates every safety invariant before a test database connection is made.
 * Error messages are static and intentionally never interpolate credentials,
 * connection strings, usernames, or passwords.
 */
export function assertSafeTestDatabase(
  source: TestDatabaseEnvironment = process.env,
): SafeTestDatabaseConfig {
  if (source.NODE_ENV !== "test") {
    return fail("Disposable database tooling requires NODE_ENV=test.");
  }
  if (source.VERIX_TEST_DATABASE !== "1") {
    return fail("Disposable database tooling requires VERIX_TEST_DATABASE=1.");
  }

  const raw = source.TEST_DATABASE_URL?.trim();
  if (!raw) {
    return fail("TEST_DATABASE_URL is required; DATABASE_URL is never used as fallback.");
  }
  if (source.DATABASE_URL?.trim() === raw) {
    return fail("TEST_DATABASE_URL must be dedicated and must not equal DATABASE_URL.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return fail("TEST_DATABASE_URL must use the postgres or postgresql protocol.");
  }

  const host = url.hostname.toLowerCase();
  if (!host) {
    return fail("TEST_DATABASE_URL must include a host.");
  }
  if (PRODUCTION_LIKE_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    return fail("TEST_DATABASE_URL points to a production-like host.");
  }
  if (!allowedHosts(source).has(host)) {
    return fail(
      "TEST_DATABASE_URL host is not local or explicitly allowed for disposable tests.",
    );
  }

  const database = databaseName(url);
  const normalizedDatabase = database.toLowerCase();
  const localSupabase =
    source.VERIX_LOCAL_SUPABASE === "verix" &&
    (host === "localhost" || host === "127.0.0.1") &&
    (url.port || "5432") === "54322" &&
    normalizedDatabase === "postgres";
  if (
    !localSupabase &&
    UNSAFE_DATABASE_NAMES.has(normalizedDatabase) ||
    (!localSupabase && !normalizedDatabase.includes(TEST_DATABASE_MARKER))
  ) {
    return fail(
      `Test database name must contain the required ${TEST_DATABASE_MARKER} marker.`,
    );
  }

  return {
    connectionString: raw,
    host,
    port: url.port || "5432",
    database,
    targetKind: localSupabase ? "local_supabase" : "disposable_database",
  };
}

export type TestDatabaseClient = ReturnType<typeof postgres>;

/** Creates a lazy postgres.js client only after all safety guards pass. */
export function createTestDatabaseClient(
  source: TestDatabaseEnvironment = process.env,
): { client: TestDatabaseClient; config: SafeTestDatabaseConfig } {
  const config = assertSafeTestDatabase(source);
  const client = postgres(config.connectionString, {
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
