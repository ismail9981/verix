import { drizzle } from "drizzle-orm/postgres-js";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../../server/db/schema";
import { assertCanonicalRlsDatabase } from "../rls/rls-harness";
import {
  setAuthenticatedContext,
  type RlsTransaction,
  withLocalRlsDatabase,
  withRollbackTransaction,
} from "../rls/rls-harness";
import { assertSafeTestDatabase } from "../test-database";
import type { TestDatabaseEnvironment } from "../test-database";
import type { TestDatabaseClient } from "../test-database";

const ids = {
  authA: "41000000-0000-4000-8000-000000000001",
  authB: "41000000-0000-4000-8000-000000000002",
  authC: "41000000-0000-4000-8000-000000000003",
  authD: "41000000-0000-4000-8000-000000000004",
  internalA: "42000000-0000-4000-8000-000000000001",
  internalB: "42000000-0000-4000-8000-000000000002",
  internalC: "42000000-0000-4000-8000-000000000003",
  workspaceA: "43000000-0000-4000-8000-000000000001",
} as const;

type WorkspaceModule = typeof import("../../../server/auth/workspace");
let workspaceModule: WorkspaceModule;
let testEnvironment: TestDatabaseEnvironment;

beforeAll(async () => {
  testEnvironment = { ...process.env };
  const config = assertSafeTestDatabase(process.env);
  if (config.targetKind !== "local_supabase") {
    throw new Error("B4 identity tests require repository-local Supabase.");
  }
  // The production module validates DATABASE_URL at import time. Point it only
  // at the B1-approved local target; tests still execute through rollback SQL.
  await withLocalRlsDatabase(assertCanonicalRlsDatabase);
  process.env.DATABASE_URL = config.connectionString;
  workspaceModule = await import("../../../server/auth/workspace");
});

function withIdentityDatabase<T>(
  operation: Parameters<typeof withLocalRlsDatabase<T>>[0],
): Promise<T> {
  return withLocalRlsDatabase(operation, testEnvironment);
}

function drizzleTransaction(
  sql: RlsTransaction,
  client: TestDatabaseClient,
): Parameters<typeof workspaceModule.resolveAuthorizedWorkspaceInTransaction>[0] {
  // postgres.js transaction scopes retain the query methods but omit the
  // root client's parser/serializer options expected by Drizzle's adapter.
  Object.defineProperty(sql, "options", {
    configurable: true,
    value: (client as unknown as { options: unknown }).options,
  });
  return drizzle(sql as never, { schema });
}

async function insertAuthUser(
  sql: RlsTransaction,
  id: string,
  email: string | null,
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

describe("B4 immutable identity resolver", () => {
  it("keeps the same internal user and Workspace after an Auth email change", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await insertAuthUser(sql, ids.authA, "identity-a@verix.local");
        const tx = drizzleTransaction(sql, client);

        const first = await workspaceModule.resolveAuthorizedWorkspaceInTransaction(
          tx,
          {
            id: ids.authA,
            email: "identity-a@verix.local",
            name: "Identity A",
            emailVerified: true,
          },
        );
        expect(first.identity.kind).toBe("NEW_IDENTITY_PROVISIONED");
        expect(first.isNewWorkspace).toBe(true);

        await sql`
          update auth.users set email = 'identity-a-renamed@verix.local'
          where id = ${ids.authA}
        `;
        const second = await workspaceModule.resolveAuthorizedWorkspaceInTransaction(
          tx,
          {
            id: ids.authA,
            email: "identity-a-renamed@verix.local",
            name: "Renamed",
            emailVerified: true,
          },
        );

        expect(second.identity.kind).toBe("ALREADY_LINKED");
        expect(second.userId).toBe(first.userId);
        expect(second.workspaceId).toBe(first.workspaceId);
        expect(second.isNewWorkspace).toBe(false);
        const [counts] = await sql<
          Array<{ users: number; workspaces: number; memberships: number }>
        >`
          select
            (select count(*)::integer from public.users
             where auth_user_id = ${ids.authA}) as users,
            (select count(*)::integer from workspaces
             where owner_id = ${first.userId}) as workspaces,
            (select count(*)::integer from team_members
             where user_id = ${first.userId}) as memberships
        `;
        expect(counts).toEqual({ users: 1, workspaces: 1, memberships: 1 });
      }),
    );
  });

  it("links one verified invited legacy placeholder case-insensitively without provisioning", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await insertAuthUser(sql, ids.authA, "legacy@verix.local");
        await sql`
          insert into public.users (id, email, full_name)
          values (${ids.internalA}, 'Legacy@Verix.Local', 'Legacy')
        `;
        await sql`
          insert into workspaces (id, owner_id, name, slug)
          values (${ids.workspaceA}, ${ids.internalA}, 'Legacy Workspace',
            'b4-legacy-workspace')
        `;
        await sql`
          insert into team_members (workspace_id, user_id, role, status)
          values (${ids.workspaceA}, ${ids.internalA}, 'owner', 'active')
        `;

        const result = await workspaceModule.resolveAuthorizedWorkspaceInTransaction(
          drizzleTransaction(sql, client),
          {
            id: ids.authA,
            email: "legacy@verix.local",
            emailVerified: true,
          },
        );
        expect(result).toMatchObject({
          userId: ids.internalA,
          workspaceId: ids.workspaceA,
          isNewWorkspace: false,
          identity: { kind: "LEGACY_LINKED" },
        });
      }),
    );
  });

  it("keeps an invited placeholder unlinked when Auth email is unverified", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await insertAuthUser(sql, ids.authA, "invited@verix.local", false);
        await sql`
          insert into public.users (id, email, email_verified)
          values (${ids.internalA}, 'Invited@Verix.Local', false)
        `;

        await expect(
          workspaceModule.resolveAuthorizedWorkspaceInTransaction(
            drizzleTransaction(sql, client),
            {
              id: ids.authA,
              email: "invited@verix.local",
              emailVerified: false,
            },
          ),
        ).rejects.toMatchObject({ code: "UNVERIFIED_LEGACY_MATCH" });
        const [placeholder] = await sql<
          Array<{ auth_user_id: string | null }>
        >`
          select auth_user_id::text from public.users where id = ${ids.internalA}
        `;
        expect(placeholder?.auth_user_id).toBeNull();
      }),
    );
  });

  it("refuses ambiguous legacy matches without linking or creating a Workspace", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await insertAuthUser(sql, ids.authA, "ambiguous@verix.local");
        await sql`
          insert into public.users (id, email) values
            (${ids.internalA}, 'Ambiguous@verix.local'),
            (${ids.internalB}, 'ambiguous@verix.local')
        `;

        await expect(
          workspaceModule.resolveAuthorizedWorkspaceInTransaction(
            drizzleTransaction(sql, client),
            {
              id: ids.authA,
              email: "ambiguous@verix.local",
              emailVerified: true,
            },
          ),
        ).rejects.toMatchObject({ code: "AMBIGUOUS_LEGACY_MATCH" });
        const [counts] = await sql<
          Array<{ linked: number; workspaces: number }>
        >`
          select
            (select count(*)::integer from public.users
             where auth_user_id is not null) as linked,
            (select count(*)::integer from workspaces) as workspaces
        `;
        expect(counts).toEqual({ linked: 0, workspaces: 0 });
      }),
    );
  });

  it("refuses a new UUID whose email belongs to another immutable identity", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await insertAuthUser(sql, ids.authA, "auth-a@verix.local");
        await insertAuthUser(sql, ids.authB, "owned@verix.local");
        await sql`
          insert into public.users (id, auth_user_id, email)
          values (${ids.internalA}, ${ids.authA}, 'owned@verix.local')
        `;

        await expect(
          workspaceModule.resolveAuthorizedWorkspaceInTransaction(
            drizzleTransaction(sql, client),
            {
              id: ids.authB,
              email: "owned@verix.local",
              emailVerified: true,
            },
          ),
        ).rejects.toMatchObject({ code: "LINKAGE_CONFLICT" });
      }),
    );
  });

  it("resolves by UUID even when Auth email equals another internal profile", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await insertAuthUser(sql, ids.authA, "other@verix.local");
        await sql`
          insert into public.users (id, auth_user_id, email) values
            (${ids.internalA}, ${ids.authA}, 'original@verix.local'),
            (${ids.internalB}, null, 'other@verix.local')
        `;
        await sql`
          insert into workspaces (id, owner_id, name, slug)
          values (${ids.workspaceA}, ${ids.internalA}, 'Identity Workspace',
            'b4-identity-workspace')
        `;
        await sql`
          insert into team_members (workspace_id, user_id, role, status)
          values (${ids.workspaceA}, ${ids.internalA}, 'owner', 'active')
        `;

        const result = await workspaceModule.resolveAuthorizedWorkspaceInTransaction(
          drizzleTransaction(sql, client),
          {
            id: ids.authA,
            email: "other@verix.local",
            emailVerified: true,
          },
        );
        expect(result.userId).toBe(ids.internalA);
        const [unlinked] = await sql<Array<{ auth_user_id: string | null }>>`
          select auth_user_id::text from public.users where id = ${ids.internalB}
        `;
        expect(unlinked?.auth_user_id).toBeNull();
      }),
    );
  });

  it("refuses null email for an unlinked Auth identity", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await insertAuthUser(sql, ids.authA, null);
        await expect(
          workspaceModule.resolveAuthorizedWorkspaceInTransaction(
            drizzleTransaction(sql, client),
            { id: ids.authA, email: null, emailVerified: false },
          ),
        ).rejects.toMatchObject({ code: "MISSING_AUTH_EMAIL" });
      }),
    );
  });

  it("keeps auth_user_id immutable while allowing ordinary profile email updates", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await insertAuthUser(sql, ids.authA, "immutable@verix.local");
        await insertAuthUser(sql, ids.authB, "other@verix.local");
        await sql`
          insert into public.users (id, auth_user_id, email)
          values (${ids.internalA}, ${ids.authA}, 'immutable@verix.local')
        `;
        await expect(
          sql.savepoint((savepoint) => savepoint`
            update public.users set auth_user_id = ${ids.authB}
            where id = ${ids.internalA}
          `),
        ).rejects.toMatchObject({ code: "23514" });

        await sql`
          update public.users set email = 'profile-renamed@verix.local'
          where id = ${ids.internalA}
        `;
        const [row] = await sql<
          Array<{ auth_user_id: string; email: string }>
        >`
          select auth_user_id::text, email from public.users
          where id = ${ids.internalA}
        `;
        expect(row).toEqual({
          auth_user_id: ids.authA,
          email: "profile-renamed@verix.local",
        });
      }),
    );
  });

  it("blocks a direct authenticated claim with another UUID", async () => {
    await withIdentityDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await insertAuthUser(sql, ids.authA, "claim-a@verix.local");
        await insertAuthUser(sql, ids.authB, "claim-b@verix.local");
        await sql`
          insert into public.users (id, auth_user_id, email) values
            (${ids.internalA}, ${ids.authA}, 'claim-a@verix.local'),
            (${ids.internalB}, null, 'claim-b@verix.local')
        `;
        await sql`
          insert into workspaces (id, owner_id, name, slug)
          values (${ids.workspaceA}, ${ids.internalA}, 'Claim Workspace',
            'b4-claim-workspace')
        `;
        await sql`
          insert into team_members (workspace_id, user_id, role, status) values
            (${ids.workspaceA}, ${ids.internalA}, 'owner', 'active'),
            (${ids.workspaceA}, ${ids.internalB}, 'employee', 'active')
        `;
        await setAuthenticatedContext(sql, ids.authA);

        await expect(
          sql.savepoint((savepoint) => savepoint`
            update public.users set auth_user_id = ${ids.authB}
            where id = ${ids.internalB}
          `),
        ).rejects.toMatchObject({ code: "42501" });
      }),
    );
  });
});
