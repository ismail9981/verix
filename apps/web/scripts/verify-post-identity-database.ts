import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCanonicalMigrationIdentities } from "../src/test/database/canonical-adoption";
import { compareCatalogManifests } from "../src/test/database/catalog/catalog-compare";
import type { CatalogManifest } from "../src/test/database/catalog/catalog-manifest";
import { fingerprintCatalogManifest } from "../src/test/database/catalog/catalog-normalize";
import { inspectPostgresCatalog } from "../src/test/database/catalog/postgres-catalog-inspector";
import {
  assertIdentityLinkagePreflightSafe,
  runIdentityLinkagePreflight,
} from "../src/test/database/identity/identity-preflight";
import { withTestDatabase } from "../src/test/database/test-database";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const expected = JSON.parse(
  await readFile(
    resolve(appDirectory, "src/test/database/catalog/manifests/post-b4.json"),
    "utf8",
  ),
) as CatalogManifest;
const migrations = await readCanonicalMigrationIdentities(appDirectory);
const identityMigration = migrations.find(
  ({ tag }) => tag === "0004_immutable_auth_identity",
);
if (!identityMigration) throw new Error("B4 migration metadata is missing.");

const result = await withTestDatabase(async (client) => {
  const [observed, preflight, ledger] = await Promise.all([
    inspectPostgresCatalog(client, "post-b4"),
    runIdentityLinkagePreflight(client),
    client<Array<{ hash: string; created_at: string }>>`
      select hash, created_at::text as created_at
      from drizzle.__drizzle_migrations order by created_at, id
    `,
  ]);
  const comparison = compareCatalogManifests(expected, observed);
  const expectedFingerprint = fingerprintCatalogManifest(expected).value;
  const observedFingerprint = fingerprintCatalogManifest(observed).value;
  assertIdentityLinkagePreflightSafe(preflight);
  const lastLedgerRow = ledger.at(-1);
  if (
    comparison.adoptionDecision !== "ADOPTABLE" ||
    observedFingerprint !== expectedFingerprint ||
    ledger.length !== migrations.length ||
    lastLedgerRow?.hash !== identityMigration.hash ||
    lastLedgerRow.created_at !== String(identityMigration.createdAt)
  ) {
    throw new Error("Post-B4 catalog, ledger, or identity preflight verification failed.");
  }
  return {
    migrationCount: ledger.length,
    internalUserCount: preflight.totalInternalUsers,
    unresolvedIdentityCount: preflight.unresolvedCount,
    constraintCount: observed.constraints.length,
    functionCount: observed.functions.length,
    triggerCount: observed.triggers.length,
    fingerprint: observedFingerprint,
    adoptionDecision: comparison.adoptionDecision,
  };
});

console.log(JSON.stringify(result));
