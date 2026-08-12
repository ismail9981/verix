import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  evaluateCanonicalBootstrapGate,
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
  it("reports the repaired active topology without changing migration metadata", async () => {
    const inventory = await readMigrationInventory(APP_DIRECTORY);

    expect(inventory.sqlFiles).toEqual([
      "0000_slim_thunderbolts.sql",
      "0001_payments_soft_delete.sql",
      "0002_canonical_pre_sprint_1.sql",
      "0003_workspace_relationship_hardening.sql",
      "0004_immutable_auth_identity.sql",
    ]);
    expect(inventory.journalTags).toEqual([
      "0000_slim_thunderbolts",
      "0001_payments_soft_delete",
      "0002_canonical_pre_sprint_1",
      "0003_workspace_relationship_hardening",
      "0004_immutable_auth_identity",
    ]);
    expect(inventory.unjournaledSqlFiles).toEqual([]);
    expect(inventory.snapshotFiles).toEqual([
      "0000_snapshot.json",
      "0001_snapshot.json",
      "0002_snapshot.json",
      "0003_snapshot.json",
      "0004_snapshot.json",
    ]);
  });

  it("preserves exact legacy 0002-0016 SQL evidence outside the active path", async () => {
    const legacyDirectory = resolve(
      APP_DIRECTORY,
      "drizzle/legacy/pre-canonical",
    );
    const expected = new Map<string, string>([
      [
        "0002_settings_expand.sql",
        "dc75e63102887a98a79700005f895cf253c7e64f1bc55aeb3fcc647d89473745",
      ],
      [
        "0003_website_builder.sql",
        "34462698b37e0910a60d63c40473e0313b12f7672ea21cde51565f22f0e65ee9",
      ],
      [
        "0004_website_publishing.sql",
        "79a78223f66b0bb92f0d4fd5e9fdc655f07e7b1eb9a964bdfea73c39fb4e84d8",
      ],
      [
        "0005_rls_invoices_integrations.sql",
        "bc130bfea689ea2c73169c5abcc593024434e675726b87d96393826a679247b5",
      ],
      [
        "0006_site_domains.sql",
        "533efc18654850fc5685743ff95d71c89fd9d7090fd29fa4a66789cb93ace4ac",
      ],
      [
        "0007_domain_verification.sql",
        "211a2744cf1d1f8843ac4bda28c418348910a9da87166d92d62e6cfa895016ed",
      ],
      [
        "0008_seo_fields.sql",
        "acdf8e257395c615e53713fce5213a809147c18d46fe5cb2b3e1f16ffe459d71",
      ],
      [
        "0009_leads.sql",
        "c61cb5ca1fd1b481aedfbe20554e28d72d73a65501830dbe91d7977d97edca51",
      ],
      [
        "0010_crm_pipeline.sql",
        "9c60cd7eff71e8107ff2e55f58c6c0211d92af481f4d9b2daeb9d168ba87108e",
      ],
      [
        "0011_reservations.sql",
        "b4296fe9afe67f751f5838c73fdb7aca99a54ea773ef7a6f7cdf77ac5aebe868",
      ],
      [
        "0012_property_management.sql",
        "7d6f9a268916b63adf6bbdba70cf7b560668275f9110042ca6563870522df760",
      ],
      [
        "0013_housekeeping.sql",
        "d23159c08b2fd75bc1e51564edc4b711bc56300909bed5447bdc86a54aeffb5c",
      ],
      [
        "0014_billing.sql",
        "b934c1db5cd33ca0be595625db1a9ee03fb12f772466f8414402160a50270994",
      ],
      [
        "0015_billing_actor_attribution.sql",
        "bd0ee6e62387740178d7e93d83e1728daf730adad17b20c17397b7c45ab45b4b",
      ],
      [
        "0016_billing_actor_immutability.sql",
        "20a21956787573fece5af469ec497dbf74b6f06024ceeb632b8ccc25fa29e15a",
      ],
    ]);
    const files = (await readdir(legacyDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(files).toEqual([...expected.keys()]);
    for (const file of files) {
      const digest = createHash("sha256")
        .update(await readFile(resolve(legacyDirectory, file)))
        .digest("hex");
      expect(digest).toBe(expected.get(file));
    }
  });

  it("requires catalog parity even when the migration process exits zero", () => {
    const gate = evaluateCanonicalBootstrapGate({
      migrationExitCode: 0,
      appliedMigrationCount: 3,
      activeMigrationCount: 3,
      unjournaledMigrationCount: 0,
      expectedFingerprint: "canonical",
      observedFingerprint: "partial-catalog",
      adoptionDecision: "NOT_ADOPTABLE",
    });
    expect(gate).toEqual({
      success: false,
      reason:
        "Migration command succeeded, but canonical fingerprint verification failed.",
    });
  });

  it("accepts only migration, ledger, and canonical fingerprint success together", () => {
    expect(
      evaluateCanonicalBootstrapGate({
        migrationExitCode: 0,
        appliedMigrationCount: 3,
        activeMigrationCount: 3,
        unjournaledMigrationCount: 0,
        expectedFingerprint: "canonical",
        observedFingerprint: "canonical",
        adoptionDecision: "ADOPTABLE",
      }).success,
    ).toBe(true);
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

  it("rejects a hosted target before invoking the migration subprocess", async () => {
    const runner = vi.fn<MigrationCommandRunner>();
    await expect(
      runCanonicalMigrationCommand(
        APP_DIRECTORY,
        testEnv({
          TEST_DATABASE_URL:
            "postgresql://private-user:private-password@aws-0-eu.pooler.supabase.com:6543/verix_test",
        }),
        runner,
      ),
    ).rejects.toThrow("REMOTE_FORBIDDEN");
    expect(runner).not.toHaveBeenCalled();
  });

  it("rejects an offline hosted Supabase project-link marker before subprocess", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "verix-b4-1-link-"));
    const appDirectory = resolve(root, "apps/web");
    const markerDirectory = resolve(root, "supabase/.temp");
    await mkdir(appDirectory, { recursive: true });
    await mkdir(markerDirectory, { recursive: true });
    await writeFile(resolve(markerDirectory, "project-ref"), "hosted-project-ref\n");
    const runner = vi.fn<MigrationCommandRunner>();
    try {
      await expect(
        runCanonicalMigrationCommand(appDirectory, testEnv(), runner),
      ).rejects.toThrow("linked hosted Supabase project");
      expect(runner).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
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
      targetKind: "disposable_database",
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
