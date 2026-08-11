import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabasePrerequisiteManifest } from "../src/test/database/catalog/catalog-manifest";
import { inspectSupabasePrerequisites } from "../src/test/database/catalog/postgres-supabase-prerequisite-inspector";
import { classifySupabasePrerequisites } from "../src/test/database/catalog/supabase-prerequisite-check";
import { withTestDatabase } from "../src/test/database/test-database";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(
  await readFile(
    resolve(
      appDirectory,
      "src/test/database/catalog/manifests/supabase-prerequisites.json",
    ),
    "utf8",
  ),
) as SupabasePrerequisiteManifest;

try {
  const observations = await withTestDatabase(inspectSupabasePrerequisites);
  const results = classifySupabasePrerequisites(manifest, observations);
  console.log(JSON.stringify(results, null, 2));
  process.exitCode = results.every((result) => result.status === "PRESENT")
    ? 0
    : 1;
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Supabase prerequisite inspection failed.",
  );
  process.exitCode = 1;
}
