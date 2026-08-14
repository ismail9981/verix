import { drizzle } from "drizzle-orm/postgres-js";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../../server/db/schema";
import type { TestDatabaseClient, TestDatabaseEnvironment } from "../test-database";
import {
  assertCanonicalRlsDatabase,
  type RlsTransaction,
  withLocalRlsDatabase,
  withRollbackTransaction,
} from "../rls/rls-harness";
import { assertSafeTestDatabase } from "../test-database";

type ActiveWorkspaceModule = typeof import("../../../server/auth/active-workspace");
let activeWorkspace: ActiveWorkspaceModule;
let testEnvironment: TestDatabaseEnvironment;

const ids = {
  auth: "71000000-0000-4000-8000-000000000001",
  user: "72000000-0000-4000-8000-000000000001",
  owner: "72000000-0000-4000-8000-000000000002",
  workspaceA: "73000000-0000-4000-8000-000000000001",
  workspaceB: "73000000-0000-4000-8000-000000000002",
  workspaceC: "73000000-0000-4000-8000-000000000003",
} as const;

beforeAll(async () => {
  testEnvironment = { ...process.env };
  const config = assertSafeTestDatabase(testEnvironment);
  await withLocalRlsDatabase(assertCanonicalRlsDatabase, testEnvironment);
  process.env.DATABASE_URL = config.connectionString;
  activeWorkspace = await import("../../../server/auth/active-workspace");
});

function drizzleTransaction(sql: RlsTransaction, client: TestDatabaseClient) {
  Object.defineProperty(sql, "options", {
    configurable: true,
    value: (client as unknown as { options: unknown }).options,
  });
  return drizzle(sql as never, { schema });
}

async function seedIdentity(sql: RlsTransaction): Promise<void> {
  await sql`
    insert into auth.users
      (id, email, email_confirmed_at, aud, role, created_at, updated_at)
    values (${ids.auth}, 'active@verix.local', now(), 'authenticated',
      'authenticated', now(), now())
  `;
  await sql`
    insert into public.users (id, auth_user_id, email) values
      (${ids.user}, ${ids.auth}, 'active@verix.local'),
      (${ids.owner}, null, 'owner@verix.local')
  `;
}

async function addWorkspace(
  sql: RlsTransaction,
  workspaceId: string,
  suffix: string,
  status = "active",
  deleted = false,
): Promise<void> {
  await sql`
    insert into workspaces (id, owner_id, name, slug, deleted_at)
    values (${workspaceId}, ${ids.owner}, ${`Workspace ${suffix}`},
      ${`b5-workspace-${suffix.toLowerCase()}`}, ${deleted ? new Date() : null})
  `;
  await sql`
    insert into team_members (workspace_id, user_id, role, status)
    values (${workspaceId}, ${ids.user}, 'manager', ${status})
  `;
}

const identity = {
  id: ids.auth,
  email: "active@verix.local",
  emailVerified: true,
} as const;

describe("B5 Active Workspace resolver", () => {
  it("returns NONE for an existing linked user with no active membership", async () => {
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedIdentity(sql);
        const result = await activeWorkspace.resolveActiveWorkspaceInTransaction(
          drizzleTransaction(sql, client), identity, null,
        );
        expect(result).toMatchObject({ state: "NONE", options: [] });
      }), testEnvironment);
  });

  it("auto-selects exactly one membership and ignores an unrelated stale candidate", async () => {
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedIdentity(sql);
        await addWorkspace(sql, ids.workspaceA, "A");
        const result = await activeWorkspace.resolveActiveWorkspaceInTransaction(
          drizzleTransaction(sql, client), identity, ids.workspaceB,
        );
        expect(result).toMatchObject({
          state: "AUTO_SELECTED",
          context: {
            workspaceId: ids.workspaceA,
            selectionSource: "single_membership",
          },
        });
      }), testEnvironment);
  });

  it("requires explicit choice for multiple memberships and accepts a valid selection", async () => {
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedIdentity(sql);
        await addWorkspace(sql, ids.workspaceA, "A");
        await addWorkspace(sql, ids.workspaceB, "B");
        const tx = drizzleTransaction(sql, client);
        const missing = await activeWorkspace.resolveActiveWorkspaceInTransaction(
          tx, identity, null,
        );
        expect(missing.state).toBe("SELECTION_REQUIRED");
        const selected = await activeWorkspace.resolveActiveWorkspaceInTransaction(
          tx, identity, ids.workspaceB,
        );
        expect(selected).toMatchObject({
          state: "SELECTED",
          context: { workspaceId: ids.workspaceB, selectionSource: "signed_cookie" },
        });
      }), testEnvironment);
  });

  it("rejects another user's workspace and an invalid/tampered selection", async () => {
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedIdentity(sql);
        await addWorkspace(sql, ids.workspaceA, "A");
        await addWorkspace(sql, ids.workspaceB, "B");
        await sql`
          insert into workspaces (id, owner_id, name, slug)
          values (${ids.workspaceC}, ${ids.owner}, 'Workspace C', 'b5-workspace-c')
        `;
        const tx = drizzleTransaction(sql, client);
        expect((await activeWorkspace.resolveActiveWorkspaceInTransaction(
          tx, identity, ids.workspaceC,
        )).state).toBe("INVALID_SELECTION");
        expect((await activeWorkspace.resolveActiveWorkspaceInTransaction(
          tx, identity, null, true,
        )).state).toBe("INVALID_SELECTION");
      }), testEnvironment);
  });

  it("invalidates suspended/deleted membership and deleted Workspace selections", async () => {
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedIdentity(sql);
        await addWorkspace(sql, ids.workspaceA, "A");
        await addWorkspace(sql, ids.workspaceB, "B");
        await addWorkspace(sql, ids.workspaceC, "C", "suspended");
        const result = await activeWorkspace.resolveActiveWorkspaceInTransaction(
          drizzleTransaction(sql, client), identity, ids.workspaceC,
        );
        expect(result.state).toBe("INVALID_SELECTION");

        await sql`
          update team_members set status = 'active'
          where workspace_id = ${ids.workspaceC} and user_id = ${ids.user}
        `;
        await sql`update workspaces set deleted_at = now() where id = ${ids.workspaceC}`;
        const deletedWorkspace = await activeWorkspace.resolveActiveWorkspaceInTransaction(
          drizzleTransaction(sql, client), identity, ids.workspaceC,
        );
        expect(deletedWorkspace.state).toBe("INVALID_SELECTION");
      }), testEnvironment);
  });

  it("requires explicit selection when a second active membership is added", async () => {
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedIdentity(sql);
        await addWorkspace(sql, ids.workspaceA, "A");
        const tx = drizzleTransaction(sql, client);
        expect((await activeWorkspace.resolveActiveWorkspaceInTransaction(
          tx, identity, null,
        )).state).toBe("AUTO_SELECTED");
        await addWorkspace(sql, ids.workspaceB, "B");
        expect((await activeWorkspace.resolveActiveWorkspaceInTransaction(
          tx, identity, null,
        )).state).toBe("SELECTION_REQUIRED");
      }), testEnvironment);
  });

  it("makes a restored membership selectable only after active status returns", async () => {
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedIdentity(sql);
        await addWorkspace(sql, ids.workspaceA, "A");
        await addWorkspace(sql, ids.workspaceB, "B", "suspended");
        const tx = drizzleTransaction(sql, client);
        expect((await activeWorkspace.resolveActiveWorkspaceInTransaction(
          tx, identity, ids.workspaceB,
        )).state).toBe("AUTO_SELECTED");
        await sql`
          update team_members set status = 'active'
          where workspace_id = ${ids.workspaceB} and user_id = ${ids.user}
        `;
        expect((await activeWorkspace.resolveActiveWorkspaceInTransaction(
          tx, identity, ids.workspaceB,
        )).state).toBe("SELECTED");
      }), testEnvironment);
  });

  it("revalidates membership removal and safely transitions multiple to one", async () => {
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedIdentity(sql);
        await addWorkspace(sql, ids.workspaceA, "A");
        await addWorkspace(sql, ids.workspaceB, "B");
        const tx = drizzleTransaction(sql, client);
        expect((await activeWorkspace.resolveActiveWorkspaceInTransaction(
          tx, identity, ids.workspaceB,
        )).state).toBe("SELECTED");
        await sql`
          update team_members set deleted_at = now()
          where workspace_id = ${ids.workspaceB} and user_id = ${ids.user}
        `;
        const after = await activeWorkspace.resolveActiveWorkspaceInTransaction(
          tx, identity, ids.workspaceB,
        );
        expect(after).toMatchObject({
          state: "AUTO_SELECTED",
          context: { workspaceId: ids.workspaceA },
        });
      }), testEnvironment);
  });

  it("keeps explicit A despite request/resource candidate B and an Auth email change", async () => {
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedIdentity(sql);
        await addWorkspace(sql, ids.workspaceA, "A");
        await addWorkspace(sql, ids.workspaceB, "B");
        await sql`update auth.users set email = 'changed@verix.local' where id = ${ids.auth}`;
        const result = await activeWorkspace.resolveActiveWorkspaceInTransaction(
          drizzleTransaction(sql, client),
          { ...identity, email: "changed@verix.local" },
          ids.workspaceA,
        );
        const requestWorkspaceId = ids.workspaceB;
        expect(result).toMatchObject({
          state: "SELECTED",
          context: { workspaceId: ids.workspaceA, internalUserId: ids.user },
        });
        expect(result.state === "SELECTED" && result.context.workspaceId).not.toBe(
          requestWorkspaceId,
        );
      }), testEnvironment);
  });
});
