import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyCanonicalAdoption,
  runCanonicalAdoptionDryRun,
} from "../src/test/database/canonical-adoption";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const apply = process.argv.slice(2).includes("--apply");

try {
  const report = apply
    ? await applyCanonicalAdoption(appDirectory)
    : await runCanonicalAdoptionDryRun(appDirectory);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode =
    report.status === "ADOPTABLE" ||
    report.status === "ADOPTED" ||
    report.status === "ALREADY_ADOPTED"
      ? 0
      : 1;
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Canonical adoption failed.",
  );
  process.exitCode = 1;
}
