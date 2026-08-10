import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrationBootstrapAudit } from "../src/test/database/migration-bootstrap";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));

try {
  const report = await runMigrationBootstrapAudit(appDirectory);
  console.log(JSON.stringify(report, null, 2));
  if (
    report.migrationResult.exitCode !== 0 ||
    report.result.drizzleMigrationCount !== report.inventory.journalTags.length ||
    report.inventory.unjournaledSqlFiles.length > 0
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Bootstrap audit failed.");
  process.exitCode = 1;
}
