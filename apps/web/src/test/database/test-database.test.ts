import { describe, expect, it, vi } from "vitest";
import {
  assertSafeTestDatabase,
  runGuardedDestructiveTestDatabaseOperation,
  type TestDatabaseEnvironment,
} from "./test-database";

const SAFE_URL =
  "postgresql://verix_test_user:test-password@localhost:5432/verix_test";

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

describe("assertSafeTestDatabase", () => {
  it("rejects a missing TEST_DATABASE_URL", () => {
    expect(() =>
      assertSafeTestDatabase(testEnv({ TEST_DATABASE_URL: undefined })),
    ).toThrow("TEST_DATABASE_URL is required");
  });

  it("never falls back to production DATABASE_URL", () => {
    expect(() =>
      assertSafeTestDatabase(
        testEnv({
          TEST_DATABASE_URL: undefined,
          DATABASE_URL:
            "postgresql://production-user:production-password@db.example.com:5432/verix",
        }),
      ),
    ).toThrow("DATABASE_URL is never used as fallback");
  });

  it("rejects a clearly unsafe database name", () => {
    expect(() =>
      assertSafeTestDatabase(
        testEnv({
          TEST_DATABASE_URL:
            "postgresql://verix_test_user:test-password@localhost:5432/postgres",
        }),
      ),
    ).toThrow("must contain the required verix_test marker");
  });

  it("accepts the verix_test naming convention on a local host", () => {
    expect(assertSafeTestDatabase(testEnv())).toMatchObject({
      host: "localhost",
      port: "5432",
      database: "verix_test",
      targetKind: "disposable_database",
    });
  });

  it("allows only the explicitly identified repository-local Supabase endpoint", () => {
    expect(
      assertSafeTestDatabase(
        testEnv({
          VERIX_LOCAL_SUPABASE: "verix",
          TEST_DATABASE_URL:
            "postgresql://postgres:local-password@127.0.0.1:54322/postgres",
        }),
      ),
    ).toMatchObject({
      host: "127.0.0.1",
      port: "54322",
      database: "postgres",
      targetKind: "local_supabase",
    });

    expect(() =>
      assertSafeTestDatabase(
        testEnv({
          VERIX_LOCAL_SUPABASE: "another-project",
          TEST_DATABASE_URL:
            "postgresql://postgres:local-password@127.0.0.1:54322/postgres",
        }),
      ),
    ).toThrow("must contain the required verix_test marker");
  });

  it("rejects a non-test execution environment", () => {
    expect(() =>
      assertSafeTestDatabase(testEnv({ NODE_ENV: "production" })),
    ).toThrow("requires NODE_ENV=test");
  });

  it("requires the explicit disposable-database confirmation flag", () => {
    expect(() =>
      assertSafeTestDatabase(testEnv({ VERIX_TEST_DATABASE: undefined })),
    ).toThrow("requires VERIX_TEST_DATABASE=1");
  });

  it("rejects a malformed database URL", () => {
    expect(() =>
      assertSafeTestDatabase(
        testEnv({ TEST_DATABASE_URL: "this-is-not-a-database-url" }),
      ),
    ).toThrow("must be a valid PostgreSQL URL");
  });

  it("rejects a dedicated test URL that equals DATABASE_URL", () => {
    expect(() =>
      assertSafeTestDatabase(testEnv({ DATABASE_URL: SAFE_URL })),
    ).toThrow("must not equal DATABASE_URL");
  });

  it("rejects production-like and unapproved remote hosts", () => {
    expect(() =>
      assertSafeTestDatabase(
        testEnv({
          TEST_DATABASE_URL:
            "postgresql://verix_test_user:test-password@db.project.supabase.co:5432/verix_test",
        }),
      ),
    ).toThrow("production-like host");

    expect(() =>
      assertSafeTestDatabase(
        testEnv({
          TEST_DATABASE_URL:
            "postgresql://verix_test_user:test-password@database.internal:5432/verix_test",
        }),
      ),
    ).toThrow("not local or explicitly allowed");
  });

  it("allows an explicitly named disposable CI service host", () => {
    expect(
      assertSafeTestDatabase(
        testEnv({
          TEST_DATABASE_URL:
            "postgresql://verix_test_user:test-password@ci-postgres:5432/verix_test_ci",
          TEST_DATABASE_ALLOWED_HOSTS: "ci-postgres",
        }),
      ),
    ).toMatchObject({
      host: "ci-postgres",
      database: "verix_test_ci",
    });
  });

  it("does not expose credentials in validation errors", () => {
    const username = "private-user";
    const password = "super-secret-password";
    const fullUrl = `postgresql://${username}:${password}@db.production.example.com:5432/verix_test`;

    let message = "";
    try {
      assertSafeTestDatabase(testEnv({ TEST_DATABASE_URL: fullUrl }));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toContain(username);
    expect(message).not.toContain(password);
    expect(message).not.toContain(fullUrl);
  });
});
describe("destructive-operation guard", () => {
  it("does not create a client or invoke destructive work before safety passes", async () => {
    const destructiveOperation = vi.fn();

    await expect(
      runGuardedDestructiveTestDatabaseOperation(
        destructiveOperation,
        testEnv({
          NODE_ENV: "production",
          TEST_DATABASE_URL:
            "postgresql://private-user:private-password@db.production.example.com:5432/verix",
        }),
      ),
    ).rejects.toThrow("requires NODE_ENV=test");

    expect(destructiveOperation).not.toHaveBeenCalled();
  });

  it("rejects generic destructive callbacks against local Supabase", async () => {
    const destructiveOperation = vi.fn();

    await expect(
      runGuardedDestructiveTestDatabaseOperation(
        destructiveOperation,
        testEnv({
          VERIX_LOCAL_SUPABASE: "verix",
          TEST_DATABASE_URL:
            "postgresql://postgres:local-password@127.0.0.1:54322/postgres",
        }),
      ),
    ).rejects.toThrow("disabled for local Supabase");
    expect(destructiveOperation).not.toHaveBeenCalled();
  });
});
