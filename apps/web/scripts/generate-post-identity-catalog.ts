import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprintCatalogManifest } from "../src/test/database/catalog/catalog-normalize";
import { inspectPostgresCatalog } from "../src/test/database/catalog/postgres-catalog-inspector";
import { withTestDatabase } from "../src/test/database/test-database";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDirectory = resolve(
  appDirectory,
  "src/test/database/catalog/manifests",
);
const manifest = await withTestDatabase((client) =>
  inspectPostgresCatalog(client, "post-b4"),
);
const fingerprint = fingerprintCatalogManifest(manifest);

await Promise.all([
  writeFile(
    resolve(outputDirectory, "post-b4.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputDirectory, "post-b4.fingerprint.json"),
    `${JSON.stringify(fingerprint, null, 2)}\n`,
  ),
]);

console.log(
  JSON.stringify({
    tables: manifest.tables.length,
    constraints: manifest.constraints.length,
    functions: manifest.functions.length,
    triggers: manifest.triggers.length,
    fingerprint: fingerprint.value,
  }),
);
