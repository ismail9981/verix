import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type DatabaseTargetClassification =
  | "LOCAL_SUPABASE_APPROVED"
  | "LOCAL_POSTGRES_APPROVED"
  | "REMOTE_FORBIDDEN"
  | "PRODUCTION_LIKE_FORBIDDEN"
  | "UNKNOWN_FORBIDDEN";

export interface DatabaseTargetEnvironment {
  NODE_ENV?: string;
  VERIX_TEST_DATABASE?: string;
  TEST_DATABASE_URL?: string;
  TEST_DATABASE_ALLOWED_HOSTS?: string;
  VERIX_LOCAL_SUPABASE?: string;
  DATABASE_URL?: string;
}

export interface DatabaseTargetDecision {
  readonly classification: DatabaseTargetClassification;
  readonly approved: boolean;
  readonly host: string | null;
  readonly port: string | null;
  readonly database: string | null;
  readonly targetKind: "disposable_database" | "local_supabase" | null;
  readonly reason: string;
}

const TEST_DATABASE_MARKER = "verix_test";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const UNSAFE_DATABASE_NAMES = new Set([
  "postgres",
  "template0",
  "template1",
  "verix",
  "prod",
  "production",
]);
const REMOTE_SUPABASE_SUFFIXES = [".supabase.co", ".supabase.com"];
const REMOTE_PROVIDER_SUFFIXES = [
  ".neon.tech",
  ".amazonaws.com",
  ".database.azure.com",
  ".render.com",
];
const PRODUCTION_HOST_LABELS = new Set([
  "prod",
  "production",
  "pooler",
  "supavisor",
]);

function decision(
  classification: DatabaseTargetClassification,
  reason: string,
  details: Partial<DatabaseTargetDecision> = {},
): DatabaseTargetDecision {
  return {
    classification,
    approved:
      classification === "LOCAL_SUPABASE_APPROVED" ||
      classification === "LOCAL_POSTGRES_APPROVED",
    host: details.host ?? null,
    port: details.port ?? null,
    database: details.database ?? null,
    targetKind: details.targetKind ?? null,
    reason,
  };
}

function parseDatabaseName(url: URL): string | null {
  const encoded = url.pathname.replace(/^\/+/, "");
  if (!encoded || encoded.includes("/")) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function isRemoteSupabaseHost(host: string): boolean {
  return REMOTE_SUPABASE_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix),
  );
}

function hasProductionLabel(host: string): boolean {
  return host
    .split(/[.-]/)
    .some((label) => PRODUCTION_HOST_LABELS.has(label));
}

function configuredDockerHosts(
  source: DatabaseTargetEnvironment,
): Set<string> {
  const hosts = new Set<string>();
  for (const raw of source.TEST_DATABASE_ALLOWED_HOSTS?.split(",") ?? []) {
    const host = raw.trim().toLowerCase();
    // Only single-label Docker/service names are eligible. Dotted domains and
    // IP addresses remain forbidden even if somebody puts them in the list.
    if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)) {
      hosts.add(host);
    }
  }
  return hosts;
}

/** Pure, deny-by-default classification. It never opens a socket or logs a URL. */
export function classifyDatabaseTarget(
  source: DatabaseTargetEnvironment,
): DatabaseTargetDecision {
  if (source.NODE_ENV !== "test") {
    return decision(
      "UNKNOWN_FORBIDDEN",
      "database security tooling requires NODE_ENV=test",
    );
  }
  if (source.VERIX_TEST_DATABASE !== "1") {
    return decision(
      "UNKNOWN_FORBIDDEN",
      "database security tooling requires VERIX_TEST_DATABASE=1",
    );
  }

  const raw = source.TEST_DATABASE_URL?.trim();
  if (!raw) {
    return decision(
      "UNKNOWN_FORBIDDEN",
      "TEST_DATABASE_URL is required; DATABASE_URL is never used as fallback",
    );
  }
  if (source.DATABASE_URL?.trim() === raw) {
    return decision(
      "UNKNOWN_FORBIDDEN",
      "TEST_DATABASE_URL must be dedicated and must not equal DATABASE_URL",
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return decision("UNKNOWN_FORBIDDEN", "invalid PostgreSQL URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return decision("UNKNOWN_FORBIDDEN", "unsupported database URL protocol");
  }

  const host = url.hostname.toLowerCase();
  const port = url.port || "5432";
  const database = parseDatabaseName(url);
  const details = { host: host || null, port, database };
  if (!host || !database) {
    return decision(
      "UNKNOWN_FORBIDDEN",
      "database URL must contain one hostname and database name",
      details,
    );
  }

  if (
    isRemoteSupabaseHost(host) ||
    REMOTE_PROVIDER_SUFFIXES.some(
      (suffix) => host === suffix.slice(1) || host.endsWith(suffix),
    ) ||
    hasProductionLabel(host)
  ) {
    return decision(
      "REMOTE_FORBIDDEN",
      "host is a known hosted database or pooler target",
      details,
    );
  }

  const normalizedDatabase = database.toLowerCase();
  const localSupabase =
    source.VERIX_LOCAL_SUPABASE === "verix" &&
    (host === "localhost" || host === "127.0.0.1") &&
    port === "54322" &&
    normalizedDatabase === "postgres";
  if (localSupabase) {
    return decision(
      "LOCAL_SUPABASE_APPROVED",
      "repository-local Supabase endpoint is explicitly selected",
      { ...details, targetKind: "local_supabase" },
    );
  }

  if (source.VERIX_LOCAL_SUPABASE !== undefined) {
    return decision(
      "UNKNOWN_FORBIDDEN",
      "VERIX_LOCAL_SUPABASE contradicts the selected endpoint",
      details,
    );
  }

  const approvedHost =
    LOOPBACK_HOSTS.has(host) || configuredDockerHosts(source).has(host);
  if (!approvedHost) {
    return decision(
      "REMOTE_FORBIDDEN",
      "hostname is not approved loopback or an explicit Docker service name",
      details,
    );
  }
  if (
    UNSAFE_DATABASE_NAMES.has(normalizedDatabase) ||
    !normalizedDatabase.includes(TEST_DATABASE_MARKER)
  ) {
    return decision(
      "PRODUCTION_LIKE_FORBIDDEN",
      `database name must contain the required ${TEST_DATABASE_MARKER} marker`,
      details,
    );
  }

  return decision(
    "LOCAL_POSTGRES_APPROVED",
    "local disposable PostgreSQL target is explicitly selected",
    { ...details, targetKind: "disposable_database" },
  );
}

export class ForbiddenDatabaseTargetError extends Error {
  constructor(readonly decision: DatabaseTargetDecision) {
    const safeHost = decision.host ?? "unavailable";
    const safeDatabase = decision.database ?? "unavailable";
    super(
      `Database target rejected [${decision.classification}] host=${safeHost} database=${safeDatabase}: ${decision.reason}.`,
    );
    this.name = "ForbiddenDatabaseTargetError";
  }
}

export function assertApprovedDatabaseTarget(
  source: DatabaseTargetEnvironment,
): DatabaseTargetDecision {
  const result = classifyDatabaseTarget(source);
  if (!result.approved) throw new ForbiddenDatabaseTargetError(result);
  return result;
}

/**
 * Supabase CLI stores a linked hosted project reference in this ignored file.
 * Reading the marker is offline. Local branch metadata is intentionally not a
 * hosted link signal and is therefore ignored.
 */
export function assertNoHostedSupabaseProjectLink(
  repositoryRoot: string,
): void {
  const marker = resolve(repositoryRoot, "supabase/.temp/project-ref");
  if (!existsSync(marker)) return;
  const projectRef = readFileSync(marker, "utf8").trim();
  if (projectRef) {
    throw new Error(
      "Database security tooling rejected a linked hosted Supabase project [REMOTE_FORBIDDEN].",
    );
  }
}
