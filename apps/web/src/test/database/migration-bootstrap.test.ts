import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  readMigrationInventory,
  runCanonicalMigrationCommand,
  sanitizeMigrationOutput,
  type MigrationCommandRunner,
} from "./migration-bootstrap";
import type { TestDatabaseEnvironment } from "./test-database";

const APP_DIRECTORY = fileURLToPath(new URL("../../..", import.meta.url));
const SAFE_URL =
  "postgresql://private-user:private-password@localhost:5432/verix_test_bootstrap";

function testEnv(
  overrides: Partial<TestDatabaseEnvironment> = {},
): TestDatabaseEnvironment {
  return {
    NODE_ENV: "test",
    VERIX_TEST_DATABASE: "1",
    TEST_DATABASE_URL: SAFE_URL,
    ...overrides,
  };
}

describe("migration bootstrap diagnostics", () => {
  it("reports the current journal gap without changing migration metadata", async () => {
    const inventory = await readMigrationInventory(APP_DIRECTORY);

    expect(inventory.sqlFiles).toHaveLength(17);
    expect(inventory.journalTags).toEqual([
      "0000_slim_thunderbolts",
      "0001_payments_soft_delete",
    ]);
    expect(inventory.unjournaledSqlFiles).toHaveLength(15);
    expect(inventory.unjournaledSqlFiles[0]).toBe("0002_settings_expand.sql");
    expect(inventory.unjournaledSqlFiles.at(-1)).toBe(
      "0016_billing_actor_immutability.sql",
    );
    expect(inventory.snapshotFiles).toEqual([
      "0000_snapshot.json",
      "0001_snapshot.json",
    ]);
  });

  it("does not invoke the canonical command before B1 safety passes", async () => {
    const runner = vi.fn<MigrationCommandRunner>();

    await expect(
      runCanonicalMigrationCommand(
        APP_DIRECTORY,
        testEnv({ NODE_ENV: "production" }),
        runner,
      ),
    ).rejects.toThrow("requires NODE_ENV=test");
    expect(runner).not.toHaveBeenCalled();
  });

  it("maps only the guarded test URL into the canonical command environment", async () => {
    const runner = vi.fn<MigrationCommandRunner>().mockResolvedValue({
      exitCode: 0,
      signal: null,
      stdout: "ok",
      stderr: "",
    });

    await runCanonicalMigrationCommand(APP_DIRECTORY, testEnv(), runner);

    expect(runner).toHaveBeenCalledOnce();
    const options = runner.mock.calls[0]?.[0];
    expect(options?.env.DATABASE_URL).toBe(SAFE_URL);
    expect(options?.cwd).toBe(APP_DIRECTORY);
  });

  it("redacts database credentials and PostgreSQL URLs", () => {
    const config = {
      connectionString: SAFE_URL,
      host: "localhost",
      port: "5432",
      database: "verix_test_bootstrap",
    } as const;
    const sanitized = sanitizeMigrationOutput(
      `failed for private-user and private-password at ${SAFE_URL}`,
      config,
    );

    expect(sanitized).not.toContain("private-user");
    expect(sanitized).not.toContain("private-password");
    expect(sanitized).not.toContain(SAFE_URL);
  });
});
