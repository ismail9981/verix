import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";
import {
  compareCatalogManifests,
  type CatalogComparison,
} from "./catalog/catalog-compare";
import type {
  CatalogFingerprint,
  CatalogManifest,
  SupabasePrerequisiteManifest,
} from "./catalog/catalog-manifest";
import { fingerprintCatalogManifest } from "./catalog/catalog-normalize";
import { inspectPostgresCatalog } from "./catalog/postgres-catalog-inspector";
import { inspectSupabasePrerequisites } from "./catalog/postgres-supabase-prerequisite-inspector";
import {
  classifySupabasePrerequisites,
  type PrerequisiteResult,
} from "./catalog/supabase-prerequisite-check";
import {
  assertSafeTestDatabase,
  withTestDatabase,
  type TestDatabaseClient,
  type TestDatabaseEnvironment,
} from "./test-database";

export const CANONICAL_MIGRATION_TAG = "0002_canonical_pre_sprint_1";
export const CANONICAL_ADOPTION_CONFIRMATION = "APPLY_B2_4";

export interface CanonicalMigrationIdentity {
  readonly index: number;
  readonly tag: string;
  readonly hash: string;
  readonly createdAt: number;
}

export interface MigrationLedgerRow {
  readonly id: number;
  readonly hash: string;
  readonly createdAt: string;
}

export type LedgerClassification =
  "READY_FOR_ADOPTION" | "ALREADY_ADOPTED" | "INVALID";

export interface AdoptionEvidence {
  readonly prerequisites: readonly PrerequisiteResult[];
  readonly expectedFingerprint: CatalogFingerprint;
  readonly observedFingerprint: CatalogFingerprint;
  readonly comparison: CatalogComparison;
  readonly ledger: readonly MigrationLedgerRow[];
  readonly ledgerClassification: LedgerClassification;
  readonly ledgerReason: string;
  readonly migration: CanonicalMigrationIdentity;
}

export interface CanonicalAdoptionReport extends AdoptionEvidence {
  readonly mode: "dry-run" | "apply";
  readonly status: "ADOPTABLE" | "REFUSED" | "ALREADY_ADOPTED" | "ADOPTED";
  readonly wouldAdopt: boolean;
  readonly schemaFingerprintUnchanged: boolean;
}

interface JournalFile {
  readonly entries: readonly {
    readonly idx: number;
    readonly when: number;
    readonly tag: string;
  }[];
}

interface CanonicalSources {
  readonly canonical: CatalogManifest;
  readonly prerequisites: SupabasePrerequisiteManifest;
  readonly migrations: readonly CanonicalMigrationIdentity[];
}

function sameLedgerEntry(
  row: MigrationLedgerRow,
  migration: CanonicalMigrationIdentity,
): boolean {
  return (
    row.hash === migration.hash && row.createdAt === String(migration.createdAt)
  );
}

export function classifyMigrationLedger(
  rows: readonly MigrationLedgerRow[],
  migrations: readonly CanonicalMigrationIdentity[],
): { classification: LedgerClassification; reason: string } {
  const canonicalIndex = migrations.findIndex(
    (migration) => migration.tag === CANONICAL_MIGRATION_TAG,
  );
  if (canonicalIndex < 0) {
    return {
      classification: "INVALID",
      reason: "Canonical migration metadata is absent.",
    };
  }

  const baseMigrations = migrations.slice(0, canonicalIndex);
  const canonicalMigration = migrations[canonicalIndex]!;
  const baseMatches =
    rows.length >= baseMigrations.length &&
    baseMigrations.every((migration, index) => {
      const row = rows[index];
      return row ? sameLedgerEntry(row, migration) : false;
    });

  if (!baseMatches) {
    return {
      classification: "INVALID",
      reason:
        "Ledger must contain exact active 0000/0001 entries before adoption.",
    };
  }
  if (rows.length === baseMigrations.length) {
    return {
      classification: "READY_FOR_ADOPTION",
      reason:
        "Ledger contains only the exact active migrations before the adoption point.",
    };
  }
  if (
    rows.length === baseMigrations.length + 1 &&
    sameLedgerEntry(rows[baseMigrations.length]!, canonicalMigration)
  ) {
    return {
      classification: "ALREADY_ADOPTED",
      reason: "Canonical adoption point is already recorded exactly.",
    };
  }
  return {
    classification: "INVALID",
    reason: "Ledger contains an unexpected, modified, or post-adoption entry.",
  };
}

export function evaluateAdoptionEvidence(
  evidence: AdoptionEvidence,
): "ADOPTABLE" | "REFUSED" | "ALREADY_ADOPTED" {
  if (evidence.prerequisites.some((result) => result.status !== "PRESENT")) {
    return "REFUSED";
  }
  if (
    evidence.comparison.adoptionDecision !== "ADOPTABLE" ||
    evidence.expectedFingerprint.value !== evidence.observedFingerprint.value
  ) {
    return "REFUSED";
  }
  if (evidence.ledgerClassification === "ALREADY_ADOPTED") {
    return "ALREADY_ADOPTED";
  }
  return evidence.ledgerClassification === "READY_FOR_ADOPTION"
    ? "ADOPTABLE"
    : "REFUSED";
}

export async function readCanonicalMigrationIdentities(
  appDirectory: string,
): Promise<readonly CanonicalMigrationIdentity[]> {
  const migrationDirectory = resolve(appDirectory, "drizzle");
  const journal = JSON.parse(
    await readFile(resolve(migrationDirectory, "meta/_journal.json"), "utf8"),
  ) as JournalFile;
  const migrations = readMigrationFiles({
    migrationsFolder: migrationDirectory,
  });

  if (journal.entries.length !== migrations.length) {
    throw new Error("Active migration journal and SQL files are inconsistent.");
  }
  return journal.entries.map((entry, index) => ({
    index: entry.idx,
    tag: entry.tag,
    hash: migrations[index]!.hash,
    createdAt: entry.when,
  }));
}

async function readCanonicalSources(
  appDirectory: string,
): Promise<CanonicalSources> {
  const manifestDirectory = resolve(
    appDirectory,
    "src/test/database/catalog/manifests",
  );
  const [canonicalText, prerequisiteText, migrations] = await Promise.all([
    readFile(resolve(manifestDirectory, "canonical-pre-sprint-1.json"), "utf8"),
    readFile(resolve(manifestDirectory, "supabase-prerequisites.json"), "utf8"),
    readCanonicalMigrationIdentities(appDirectory),
  ]);
  return {
    canonical: JSON.parse(canonicalText) as CatalogManifest,
    prerequisites: JSON.parse(prerequisiteText) as SupabasePrerequisiteManifest,
    migrations,
  };
}

async function inspectMigrationLedger(
  client: TestDatabaseClient,
): Promise<readonly MigrationLedgerRow[]> {
  const [relation] = await client<Array<{ exists: boolean }>>`
    select to_regclass('drizzle.__drizzle_migrations') is not null as exists
  `;
  if (!relation?.exists) return [];
  const rows = await client<
    Array<{ id: number; hash: string; created_at: string }>
  >`
    select id, hash, created_at::text as created_at
    from drizzle.__drizzle_migrations
    order by created_at, id
  `;
  return rows.map((row) => ({
    id: row.id,
    hash: row.hash,
    createdAt: row.created_at,
  }));
}

async function collectEvidence(
  client: TestDatabaseClient,
  sources: CanonicalSources,
): Promise<AdoptionEvidence> {
  const [observed, prerequisiteObservations, ledger] = await Promise.all([
    inspectPostgresCatalog(client),
    inspectSupabasePrerequisites(client),
    inspectMigrationLedger(client),
  ]);
  const migration = sources.migrations.find(
    (candidate) => candidate.tag === CANONICAL_MIGRATION_TAG,
  );
  if (!migration)
    throw new Error("Canonical migration identity could not be resolved.");
  const ledgerResult = classifyMigrationLedger(ledger, sources.migrations);
  return {
    prerequisites: classifySupabasePrerequisites(
      sources.prerequisites,
      prerequisiteObservations,
    ),
    expectedFingerprint: fingerprintCatalogManifest(sources.canonical),
    observedFingerprint: fingerprintCatalogManifest(observed),
    comparison: compareCatalogManifests(sources.canonical, observed),
    ledger,
    ledgerClassification: ledgerResult.classification,
    ledgerReason: ledgerResult.reason,
    migration,
  };
}

function reportFromEvidence(
  evidence: AdoptionEvidence,
  mode: "dry-run" | "apply",
  status: CanonicalAdoptionReport["status"],
  unchanged = true,
): CanonicalAdoptionReport {
  return {
    ...evidence,
    mode,
    status,
    wouldAdopt: evaluateAdoptionEvidence(evidence) === "ADOPTABLE",
    schemaFingerprintUnchanged: unchanged,
  };
}

export async function runCanonicalAdoptionDryRun(
  appDirectory: string,
  source: TestDatabaseEnvironment = process.env,
): Promise<CanonicalAdoptionReport> {
  assertSafeTestDatabase(source);
  const sources = await readCanonicalSources(appDirectory);
  return withTestDatabase(async (client) => {
    const evidence = await collectEvidence(client, sources);
    const result = evaluateAdoptionEvidence(evidence);
    return reportFromEvidence(
      evidence,
      "dry-run",
      result === "ADOPTABLE" ? "ADOPTABLE" : result,
    );
  }, source);
}

export async function applyCanonicalAdoption(
  appDirectory: string,
  source: TestDatabaseEnvironment = process.env,
): Promise<CanonicalAdoptionReport> {
  assertSafeTestDatabase(source);
  if (source.VERIX_CANONICAL_ADOPTION !== CANONICAL_ADOPTION_CONFIRMATION) {
    throw new Error(
      "Explicit B2.4 canonical adoption confirmation is required.",
    );
  }
  const sources = await readCanonicalSources(appDirectory);
  return withTestDatabase(
    async (client) =>
      client.begin(async (transaction) => {
        const tx = transaction as unknown as TestDatabaseClient;
        await tx`select pg_advisory_xact_lock(hashtext('verix:b2.4:canonical-adoption'))`;
        await tx`lock table drizzle.__drizzle_migrations in share row exclusive mode`;
        const before = await collectEvidence(tx, sources);
        const decision = evaluateAdoptionEvidence(before);
        if (decision === "REFUSED") {
          throw new Error(`Canonical adoption refused: ${before.ledgerReason}`);
        }
        if (decision === "ALREADY_ADOPTED") {
          return reportFromEvidence(before, "apply", "ALREADY_ADOPTED");
        }

        await tx`
        insert into drizzle.__drizzle_migrations (hash, created_at)
        values (${before.migration.hash}, ${before.migration.createdAt})
      `;
        const after = await collectEvidence(tx, sources);
        const unchanged =
          before.observedFingerprint.value === after.observedFingerprint.value;
        if (
          !unchanged ||
          after.ledgerClassification !== "ALREADY_ADOPTED" ||
          after.comparison.adoptionDecision !== "ADOPTABLE"
        ) {
          throw new Error(
            "Canonical adoption postcondition failed; transaction aborted.",
          );
        }
        return reportFromEvidence(after, "apply", "ADOPTED", unchanged);
      }),
    source,
  );
}
