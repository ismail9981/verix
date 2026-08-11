import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateCanonicalBootstrapGate,
  runMigrationBootstrapAudit,
} from "../src/test/database/migration-bootstrap";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));

try {
  const report = await runMigrationBootstrapAudit(appDirectory);
  console.log(JSON.stringify(report, null, 2));
  const gate = evaluateCanonicalBootstrapGate({
    migrationExitCode: report.migrationResult.exitCode,
    appliedMigrationCount: report.result.drizzleMigrationCount,
    activeMigrationCount: report.inventory.journalTags.length,
    unjournaledMigrationCount: report.inventory.unjournaledSqlFiles.length,
    expectedFingerprint: report.canonicalVerification.expectedFingerprint,
    observedFingerprint: report.canonicalVerification.observedFingerprint,
    adoptionDecision: report.canonicalVerification.adoptionDecision,
  });
  if (!gate.success) {
    console.error(gate.reason);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Bootstrap audit failed.",
  );
  process.exitCode = 1;
}
