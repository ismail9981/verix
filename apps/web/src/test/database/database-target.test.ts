import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertNoHostedSupabaseProjectLink,
  classifyDatabaseTarget,
  type DatabaseTargetEnvironment,
} from "./database-target";

function environment(
  url: string | undefined,
  overrides: Partial<DatabaseTargetEnvironment> = {},
): DatabaseTargetEnvironment {
  return {
    NODE_ENV: "test",
    VERIX_TEST_DATABASE: "1",
    TEST_DATABASE_URL: url,
    ...overrides,
  };
}

describe("B4.1 database target classifier", () => {
  it.each(["127.0.0.1", "localhost"])(
    "accepts repository-local Supabase through %s",
    (host) => {
      expect(
        classifyDatabaseTarget(
          environment(
            `postgresql://postgres:secret@${host}:54322/postgres`,
            { VERIX_LOCAL_SUPABASE: "verix" },
          ),
        ),
      ).toMatchObject({
        classification: "LOCAL_SUPABASE_APPROVED",
        approved: true,
        targetKind: "local_supabase",
      });
    },
  );

  it.each([
    "db.project.supabase.co",
    "aws-0-region.pooler.supabase.com",
    "tenant.supavisor.example.com",
    "database.public.example.org",
    "192.168.0.10",
  ])("denies remote target %s", (host) => {
    expect(
      classifyDatabaseTarget(
        environment(
          `postgresql://private-user:private-password@${host}:5432/verix_test`,
        ),
      ),
    ).toMatchObject({ approved: false, classification: "REMOTE_FORBIDDEN" });
  });

  it("denies by default when explicit test input is absent", () => {
    expect(
      classifyDatabaseTarget(
        environment(undefined, {
          DATABASE_URL:
            "postgresql://production:secret@db.project.supabase.co/postgres",
        }),
      ),
    ).toMatchObject({
      approved: false,
      classification: "UNKNOWN_FORBIDDEN",
    });
  });

  it("allows an unlinked local repository and rejects an offline link marker", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "verix-b4-1-project-"));
    try {
      expect(() => assertNoHostedSupabaseProjectLink(root)).not.toThrow();
      const markerDirectory = resolve(root, "supabase/.temp");
      await mkdir(markerDirectory, { recursive: true });
      await writeFile(resolve(markerDirectory, "project-ref"), "remote-ref\n");
      expect(() => assertNoHostedSupabaseProjectLink(root)).toThrow(
        "linked hosted Supabase project",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
