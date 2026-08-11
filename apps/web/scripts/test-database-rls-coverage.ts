import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CatalogManifest } from "../src/test/database/catalog/catalog-manifest";
import {
  buildRlsCoverageInventory,
  summarizeRlsCoverage,
} from "../src/test/database/rls/rls-inventory";

const manifest = JSON.parse(
  await readFile(
    resolve(
      process.cwd(),
      "src/test/database/catalog/manifests/canonical-pre-sprint-1.json",
    ),
    "utf8",
  ),
) as CatalogManifest;
const inventory = buildRlsCoverageInventory(manifest);

process.stdout.write(
  `${JSON.stringify({ summary: summarizeRlsCoverage(inventory), inventory }, null, 2)}\n`,
);
