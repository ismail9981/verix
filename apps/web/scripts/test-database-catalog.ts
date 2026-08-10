import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareCatalogManifests } from "../src/test/database/catalog/catalog-compare";
import type { CatalogManifest } from "../src/test/database/catalog/catalog-manifest";
import { fingerprintCatalogManifest } from "../src/test/database/catalog/catalog-normalize";
import { inspectPostgresCatalog } from "../src/test/database/catalog/postgres-catalog-inspector";
import { withTestDatabase } from "../src/test/database/test-database";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const canonical = JSON.parse(
  await readFile(
    resolve(
      appDirectory,
      "src/test/database/catalog/manifests/canonical-pre-sprint-1.json",
    ),
    "utf8",
  ),
) as CatalogManifest;

try {
  const observed = await withTestDatabase(inspectPostgresCatalog);
  const comparison = compareCatalogManifests(canonical, observed);
  console.log(
    JSON.stringify(
      {
        canonicalFingerprint: fingerprintCatalogManifest(canonical),
        observedFingerprint: fingerprintCatalogManifest(observed),
        adoptionDecision: comparison.adoptionDecision,
        counts: comparison.counts,
        differences: comparison.differences,
      },
      null,
      2,
    ),
  );
  process.exitCode = comparison.adoptionDecision === "ADOPTABLE" ? 0 : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Catalog inspection failed.");
  process.exitCode = 1;
}
