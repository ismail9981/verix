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
    resolve(appDirectory, "src/test/database/catalog/manifests/post-b6.3.json"),
    "utf8",
  ),
) as CatalogManifest;
const migrations = await readCanonicalMigrationIdentities(appDirectory);
const aclMigration = migrations.find(
  ({ tag }) => tag === "0005_postgrest_acl_hardening",
);
if (!aclMigration) throw new Error("B6.3 migration metadata is missing.");

const result = await withTestDatabase(async (client) => {
  const [observed, preflight, ledger] = await Promise.all([
    inspectPostgresCatalog(client, "post-b6.3"),
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
    lastLedgerRow?.hash !== aclMigration.hash ||
    lastLedgerRow.created_at !== String(aclMigration.createdAt)
  ) {
    throw new Error(
      "Post-B6.3 catalog, ledger, or identity preflight verification failed.",
    );
  }
  return {
    migrationCount: ledger.length,
    internalUserCount: preflight.totalInternalUsers,
    unresolvedIdentityCount: preflight.unresolvedCount,
    grantCount: observed.grants.length,
    fingerprint: observedFingerprint,
    adoptionDecision: comparison.adoptionDecision,
  };
});

console.log(JSON.stringify(result));
