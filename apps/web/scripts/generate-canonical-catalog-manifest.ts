import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRepositoryCanonicalManifest,
  buildSupabasePrerequisiteManifest,
} from "../src/test/database/catalog/repository-canonical-manifest";
import { fingerprintCatalogManifest } from "../src/test/database/catalog/catalog-normalize";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDirectory = resolve(
  appDirectory,
  "src/test/database/catalog/manifests",
);
const canonical = await buildRepositoryCanonicalManifest(appDirectory);
const prerequisites = buildSupabasePrerequisiteManifest();
const fingerprint = fingerprintCatalogManifest(canonical);

await Promise.all([
  writeFile(
    resolve(outputDirectory, "canonical-pre-sprint-1.json"),
    `${JSON.stringify(canonical, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputDirectory, "canonical-pre-sprint-1.fingerprint.json"),
    `${JSON.stringify(fingerprint, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputDirectory, "supabase-prerequisites.json"),
    `${JSON.stringify(prerequisites, null, 2)}\n`,
  ),
]);

console.log(
  JSON.stringify({
    tables: canonical.tables.length,
    enums: canonical.enums.length,
    indexes: canonical.indexes.length,
    constraints: canonical.constraints.length,
    functions: canonical.functions.length,
    triggers: canonical.triggers.length,
    rls: canonical.rls.length,
    policies: canonical.policies.length,
    grants: canonical.grants.length,
    ambiguities: canonical.ambiguities.length,
    prerequisites: prerequisites.prerequisites.length,
    fingerprint: fingerprint.value,
  }),
);
