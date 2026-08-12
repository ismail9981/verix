import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  assertCanonicalRlsDatabase,
  type RlsTransaction,
  withLocalRlsDatabase,
  withRollbackTransaction,
} from "../rls/rls-harness";
import { assertSafeTestDatabase } from "../test-database";
import type { TestDatabaseEnvironment } from "../test-database";
import type { TestDatabaseClient } from "../test-database";
import { runIdentityLinkagePreflight } from "./identity-preflight";

const migrationPath = resolve(
  process.cwd(),
  "drizzle/0004_immutable_auth_identity.sql",
);

let testEnvironment: TestDatabaseEnvironment;

beforeAll(async () => {
  testEnvironment = { ...process.env };
  const config = assertSafeTestDatabase(testEnvironment);
  if (config.targetKind !== "local_supabase") {
    throw new Error("B4 migration tests require repository-local Supabase.");
  }
  await withLocalRlsDatabase(assertCanonicalRlsDatabase, testEnvironment);
});

function withIdentityDatabase<T>(
  operation: Parameters<typeof withLocalRlsDatabase<T>>[0],
): Promise<T> {
  return withLocalRlsDatabase(operation, testEnvironment);
}

async function insertAuthUser(
  sql: RlsTransaction,
  id: string,
  email: string,
  verified = true,
): Promise<void> {
  await sql`
    insert into auth.users
      (id, email, email_confirmed_at, aud, role, created_at, updated_at)
    values
      (${id}, ${email}, ${verified ? new Date() : null}, 'authenticated',
       'authenticated', now(), now())
  `;
}

async function executeMigration(sql: RlsTransaction): Promise<void> {
  const migration = await readFile(migrationPath, "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) await sql.unsafe(statement);
  }
}

describe("B4 identity migration", () => {
  it("upgrades a disposable pre-B4 state without loss or ambiguous linkage", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await sql.unsafe(`
          drop trigger enforce_auth_user_id_immutability_trg on public.users;
          drop function public.enforce_auth_user_id_immutability();
          create or replace function public.current_workspace_ids()
          returns setof uuid language sql stable security definer
          set search_path = public as $function$
            select tm.workspace_id
            from public.team_members tm
            join public.users u on u.id = tm.user_id and u.deleted_at is null
            join auth.users au on lower(au.email) = lower(u.email)
            where au.id = auth.uid()
              and tm.status = 'active'
              and tm.deleted_at is null
          $function$;
          alter table public.users drop constraint users_auth_user_id_uq;
          alter table public.users drop column auth_user_id;
        `);

        await insertAuthUser(
          sql,
          "51000000-0000-4000-8000-000000000001",
          "exact@verix.local",
        );
        await insertAuthUser(
          sql,
          "51000000-0000-4000-8000-000000000002",
          "ambiguous@verix.local",
        );
        await sql`
          insert into public.users (id, email, full_name) values
            ('52000000-0000-4000-8000-000000000001', 'Exact@Verix.Local', 'Exact'),
            ('52000000-0000-4000-8000-000000000002', 'no-match@verix.local', 'No Match'),
            ('52000000-0000-4000-8000-000000000003', 'Ambiguous@verix.local', 'Ambiguous A'),
            ('52000000-0000-4000-8000-000000000004', 'ambiguous@verix.local', 'Ambiguous B')
        `;

        await executeMigration(sql);

        const rows = await sql<
          Array<{ email: string; auth_user_id: string | null; email_verified: boolean }>
        >`
          select email, auth_user_id::text, email_verified
          from public.users
          order by id
        `;
        expect(rows).toEqual([
          {
            email: "Exact@Verix.Local",
            auth_user_id: "51000000-0000-4000-8000-000000000001",
            email_verified: true,
          },
          { email: "no-match@verix.local", auth_user_id: null, email_verified: false },
          { email: "Ambiguous@verix.local", auth_user_id: null, email_verified: false },
          { email: "ambiguous@verix.local", auth_user_id: null, email_verified: false },
        ]);

        const [catalog] = await sql<
          Array<{ unique_link: boolean; trigger_exists: boolean; uses_auth_uuid: boolean }>
        >`
          select
            exists (
              select 1 from pg_constraint
              where conname = 'users_auth_user_id_uq'
            ) as unique_link,
            exists (
              select 1 from pg_trigger
              where tgname = 'enforce_auth_user_id_immutability_trg'
                and not tgisinternal
            ) as trigger_exists,
            position('u.auth_user_id = auth.uid()' in pg_get_functiondef(
              'public.current_workspace_ids()'::regprocedure
            )) > 0 as uses_auth_uuid
        `;
        expect(catalog).toEqual({
          unique_link: true,
          trigger_exists: true,
          uses_auth_uuid: true,
        });
      }),
    );
  });

  it("classifies exact, missing, ambiguous, linked, and conflict states", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await insertAuthUser(sql, "53000000-0000-4000-8000-000000000001", "exact@verix.local");
        await insertAuthUser(sql, "53000000-0000-4000-8000-000000000002", "ambiguous@verix.local");
        await insertAuthUser(sql, "53000000-0000-4000-8000-000000000003", "linked@verix.local");
        await sql`
          insert into public.users (id, auth_user_id, email) values
            ('54000000-0000-4000-8000-000000000001', null, 'Exact@verix.local'),
            ('54000000-0000-4000-8000-000000000002', null, 'missing@verix.local'),
            ('54000000-0000-4000-8000-000000000003', null, 'Ambiguous@verix.local'),
            ('54000000-0000-4000-8000-000000000004', null, 'ambiguous@verix.local'),
            ('54000000-0000-4000-8000-000000000005', '53000000-0000-4000-8000-000000000003', 'linked@verix.local'),
            ('54000000-0000-4000-8000-000000000006', '53000000-0000-4000-8000-000000000099', 'conflict@verix.local')
        `;

        const report = await runIdentityLinkagePreflight(
          sql as unknown as TestDatabaseClient,
        );
        expect(report).toMatchObject({
          totalInternalUsers: 6,
          counts: {
            EXACT_MATCH: 1,
            NO_AUTH_MATCH: 1,
            AMBIGUOUS_MATCH: 2,
            ALREADY_LINKED: 1,
            CONFLICT: 1,
          },
          unresolvedCount: 4,
          conflictCount: 1,
          safeForMigration: false,
        });
      }),
    );
  });
});
