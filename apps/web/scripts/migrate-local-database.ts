import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCanonicalMigrationCommand } from "../src/test/database/migration-bootstrap";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));

try {
  const result = await runCanonicalMigrationCommand(appDirectory);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.signal) {
    throw new Error(`Local migration process ended with signal ${result.signal}.`);
  }
  process.exitCode = result.exitCode ?? 1;
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Local migration was rejected.",
  );
  process.exitCode = 1;
}

