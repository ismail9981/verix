import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCanonicalMigrationIdentities } from "../src/test/database/canonical-adoption";
import { compareCatalogManifests } from "../src/test/database/catalog/catalog-compare";
import type { CatalogManifest } from "../src/test/database/catalog/catalog-manifest";
import { fingerprintCatalogManifest } from "../src/test/database/catalog/catalog-normalize";
import { inspectPostgresCatalog } from "../src/test/database/catalog/postgres-catalog-inspector";
import {
  assertRelationshipPreflightSafe,
  runRelationshipPreflight,
} from "../src/test/database/relationships/relationship-preflight";
import { withTestDatabase } from "../src/test/database/test-database";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const expected = JSON.parse(
  await readFile(
    resolve(appDirectory, "src/test/database/catalog/manifests/post-b3.2.json"),
    "utf8",
  ),
) as CatalogManifest;
const migrations = await readCanonicalMigrationIdentities(appDirectory);
const hardeningMigration = migrations.find(
  ({ tag }) => tag === "0003_workspace_relationship_hardening",
);
if (!hardeningMigration) throw new Error("B3.2 migration metadata is missing.");

const result = await withTestDatabase(async (client) => {
  const [observed, preflight, ledger] = await Promise.all([
    inspectPostgresCatalog(client, "post-b3.2"),
    runRelationshipPreflight(client),
    client<Array<{ hash: string; created_at: string }>>`
      select hash, created_at::text as created_at
      from drizzle.__drizzle_migrations order by created_at, id
    `,
  ]);
  const comparison = compareCatalogManifests(expected, observed);
  const expectedFingerprint = fingerprintCatalogManifest(expected).value;
  const observedFingerprint = fingerprintCatalogManifest(observed).value;
  assertRelationshipPreflightSafe(preflight);
  const lastLedgerRow = ledger.at(-1);
  if (
    comparison.adoptionDecision !== "ADOPTABLE" ||
    observedFingerprint !== expectedFingerprint ||
    ledger.length !== migrations.length ||
    lastLedgerRow?.hash !== hardeningMigration.hash ||
    lastLedgerRow.created_at !== String(hardeningMigration.createdAt)
  ) {
    throw new Error(
      "Post-B3.2 catalog, ledger, or preflight verification failed.",
    );
  }
  return {
    relationshipCount: preflight.relationshipCount,
    preflightSafe: preflight.safe,
    migrationCount: ledger.length,
    constraintCount: observed.constraints.length,
    fingerprint: observedFingerprint,
    adoptionDecision: comparison.adoptionDecision,
  };
});

console.log(JSON.stringify(result));
