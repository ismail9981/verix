import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type postgres from "postgres";
import {
  compareCatalogManifests,
  type AdoptionDecision,
} from "../catalog/catalog-compare";
import type {
  CatalogManifest,
  SupabasePrerequisiteManifest,
} from "../catalog/catalog-manifest";
import { fingerprintCatalogManifest } from "../catalog/catalog-normalize";
import { inspectPostgresCatalog } from "../catalog/postgres-catalog-inspector";
import { inspectSupabasePrerequisites } from "../catalog/postgres-supabase-prerequisite-inspector";
import { classifySupabasePrerequisites } from "../catalog/supabase-prerequisite-check";
import {
  assertSafeTestDatabase,
  withTestDatabase,
  type TestDatabaseClient,
  type TestDatabaseEnvironment,
} from "../test-database";

export const POST_B3_2_FINGERPRINT =
  "29319410f324190cdd7a15977091ceeebfb01804db8b9a497522238ebe04db00";

export type RlsTransaction = postgres.TransactionSql;

export interface CanonicalRlsGateResult {
  readonly expectedFingerprint: string;
  readonly observedFingerprint: string;
  readonly adoptionDecision: AdoptionDecision;
  readonly prerequisitesPresent: number;
}

export interface DatabaseRoleEvidence {
  readonly currentUser: string;
  readonly sessionUser: string;
  readonly superuser: boolean;
  readonly bypassRls: boolean;
}

class IntentionalRlsRollback extends Error {}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

/**
 * Refuses to run behavioral RLS tests unless the local database is the exact
 * B2.4 canonical catalog and all Supabase prerequisites are present.
 */
export async function assertCanonicalRlsDatabase(
  client: TestDatabaseClient,
  appDirectory = process.cwd(),
): Promise<CanonicalRlsGateResult> {
  const manifestDirectory = resolve(
    appDirectory,
    "src/test/database/catalog/manifests",
  );
  const [canonical, prerequisiteManifest, observed, prerequisiteObservations] =
    await Promise.all([
      readJson<CatalogManifest>(resolve(manifestDirectory, "post-b3.2.json")),
      readJson<SupabasePrerequisiteManifest>(
        resolve(manifestDirectory, "supabase-prerequisites.json"),
      ),
      inspectPostgresCatalog(client, "post-b3.2"),
      inspectSupabasePrerequisites(client),
    ]);
  const comparison = compareCatalogManifests(canonical, observed);
  const expectedFingerprint = fingerprintCatalogManifest(canonical).value;
  const observedFingerprint = fingerprintCatalogManifest(observed).value;
  const prerequisites = classifySupabasePrerequisites(
    prerequisiteManifest,
    prerequisiteObservations,
  );
  const failedPrerequisites = prerequisites.filter(
    ({ status }) => status !== "PRESENT",
  );

  if (
    expectedFingerprint !== POST_B3_2_FINGERPRINT ||
    observedFingerprint !== expectedFingerprint ||
    comparison.adoptionDecision !== "ADOPTABLE" ||
    failedPrerequisites.length > 0
  ) {
    throw new Error(
      "B3 RLS tests require the exact post-B3.2 local Supabase catalog and prerequisites.",
    );
  }

  return {
    expectedFingerprint,
    observedFingerprint,
    adoptionDecision: comparison.adoptionDecision,
    prerequisitesPresent: prerequisites.length,
  };
}

export async function inspectCurrentRole(
  sql: RlsTransaction,
): Promise<DatabaseRoleEvidence> {
  const [role] = await sql<
    Array<{
      current_user: string;
      session_user: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>
  >`
    select current_user, session_user, rolsuper, rolbypassrls
    from pg_roles where rolname = current_user
  `;
  if (!role) throw new Error("Current PostgreSQL role could not be inspected.");
  return {
    currentUser: role.current_user,
    sessionUser: role.session_user,
    superuser: role.rolsuper,
    bypassRls: role.rolbypassrls,
  };
}

/** Establishes the real local Supabase authenticated role and auth.uid claim. */
export async function setAuthenticatedContext(
  sql: RlsTransaction,
  authUserId: string,
): Promise<DatabaseRoleEvidence> {
  await sql.unsafe("set local role authenticated");
  await sql`select set_config('request.jwt.claim.sub', ${authUserId}, true)`;
  await sql`select set_config('request.jwt.claim.role', 'authenticated', true)`;

  const [claim] = await sql<Array<{ uid: string | null }>>`
    select auth.uid()::text as uid
  `;
  const evidence = await inspectCurrentRole(sql);
  if (
    evidence.currentUser !== "authenticated" ||
    evidence.superuser ||
    evidence.bypassRls ||
    claim?.uid !== authUserId
  ) {
    throw new Error(
      "Authenticated RLS context is invalid or has database bypass privileges.",
    );
  }
  return evidence;
}

/**
 * Runs a test in a transaction that is always rolled back. Fixtures are
 * installed by the owner before the callback switches to an application role.
 */
export async function withRollbackTransaction<T>(
  client: TestDatabaseClient,
  operation: (sql: RlsTransaction) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  try {
    await client.begin(async (sql) => {
      result = await operation(sql);
      throw new IntentionalRlsRollback();
    });
  } catch (error) {
    if (!(error instanceof IntentionalRlsRollback)) throw error;
  }
  return result as T;
}

export async function withLocalRlsDatabase<T>(
  operation: (client: TestDatabaseClient) => Promise<T>,
  source: TestDatabaseEnvironment = process.env,
): Promise<T> {
  const config = assertSafeTestDatabase(source);
  if (config.targetKind !== "local_supabase") {
    throw new Error(
      "B3 authoritative tests require repository-local Supabase.",
    );
  }
  return withTestDatabase(async (client) => operation(client), source);
}
