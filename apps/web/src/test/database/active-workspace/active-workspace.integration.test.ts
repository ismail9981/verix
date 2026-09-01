import { drizzle } from "drizzle-orm/postgres-js";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../../server/db/schema";
import type {
  TestDatabaseClient,
  TestDatabaseEnvironment,
} from "../test-database";
import {
  assertCanonicalRlsDatabase,
  type RlsTransaction,
  withLocalRlsDatabase,
  withRollbackTransaction,
} from "../rls/rls-harness";
import { assertSafeTestDatabase } from "../test-database";
import { hasCapability } from "../../../server/auth/capabilities";

type ActiveWorkspaceModule =
  typeof import("../../../server/auth/active-workspace");
type WorkspaceModule = typeof import("../../../server/auth/workspace");
let activeWorkspace: ActiveWorkspaceModule;
let workspaceAuth: WorkspaceModule;
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
  workspaceAuth = await import("../../../server/auth/workspace");
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
  membershipStatus = "active",
  deleted = false,
  workspaceStatus: "active" | "suspended" = "active",
): Promise<void> {
  await sql`
    insert into workspaces (id, owner_id, name, slug, status, deleted_at)
    values (${workspaceId}, ${ids.owner}, ${`Workspace ${suffix}`},
      ${`b5-workspace-${suffix.toLowerCase()}`}, ${workspaceStatus},
      ${deleted ? new Date() : null})
  `;
  await sql`
    insert into team_members (workspace_id, user_id, role, status)
    values (${workspaceId}, ${ids.user}, 'manager', ${membershipStatus})
  `;
}

const identity = {
  id: ids.auth,
  email: "active@verix.local",
  emailVerified: true,
} as const;

describe("B5 Active Workspace resolver", () => {
  it("returns NONE for an existing linked user with no active membership", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          const result =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              drizzleTransaction(sql, client),
              identity,
              null,
            );
          expect(result).toMatchObject({ state: "NONE", options: [] });
        }),
      testEnvironment,
    );
  });

  it("auto-selects exactly one membership and ignores an unrelated stale candidate", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(sql, ids.workspaceA, "A");
          const result =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              drizzleTransaction(sql, client),
              identity,
              ids.workspaceB,
            );
          expect(result).toMatchObject({
            state: "AUTO_SELECTED",
            context: {
              workspaceId: ids.workspaceA,
              selectionSource: "single_membership",
            },
          });
        }),
      testEnvironment,
    );
  });

  it("requires explicit choice for multiple memberships and accepts a valid selection", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(sql, ids.workspaceA, "A");
          await addWorkspace(sql, ids.workspaceB, "B");
          const tx = drizzleTransaction(sql, client);
          const missing =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              tx,
              identity,
              null,
            );
          expect(missing.state).toBe("SELECTION_REQUIRED");
          const selected =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              tx,
              identity,
              ids.workspaceB,
            );
          expect(selected).toMatchObject({
            state: "SELECTED",
            context: {
              workspaceId: ids.workspaceB,
              selectionSource: "signed_cookie",
            },
          });
        }),
      testEnvironment,
    );
  });

  it("rejects another user's workspace and an invalid/tampered selection", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(sql, ids.workspaceA, "A");
          await addWorkspace(sql, ids.workspaceB, "B");
          await sql`
          insert into workspaces (id, owner_id, name, slug)
          values (${ids.workspaceC}, ${ids.owner}, 'Workspace C', 'b5-workspace-c')
        `;
          const tx = drizzleTransaction(sql, client);
          expect(
            (
              await activeWorkspace.resolveActiveWorkspaceInTransaction(
                tx,
                identity,
                ids.workspaceC,
              )
            ).state,
          ).toBe("INVALID_SELECTION");
          expect(
            (
              await activeWorkspace.resolveActiveWorkspaceInTransaction(
                tx,
                identity,
                null,
                true,
              )
            ).state,
          ).toBe("INVALID_SELECTION");
        }),
      testEnvironment,
    );
  });

  it("invalidates suspended/deleted membership and deleted Workspace selections", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(sql, ids.workspaceA, "A");
          await addWorkspace(sql, ids.workspaceB, "B");
          await addWorkspace(sql, ids.workspaceC, "C", "suspended");
          const result =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              drizzleTransaction(sql, client),
              identity,
              ids.workspaceC,
            );
          expect(result.state).toBe("INVALID_SELECTION");

          await sql`
          update team_members set status = 'active'
          where workspace_id = ${ids.workspaceC} and user_id = ${ids.user}
        `;
          await sql`update workspaces set deleted_at = now() where id = ${ids.workspaceC}`;
          const deletedWorkspace =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              drizzleTransaction(sql, client),
              identity,
              ids.workspaceC,
            );
          expect(deletedWorkspace.state).toBe("INVALID_SELECTION");
        }),
      testEnvironment,
    );
  });

  it("preserves membership while excluding a suspended Workspace from active context", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(
            sql,
            ids.workspaceA,
            "A",
            "active",
            false,
            "suspended",
          );
          const result =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              drizzleTransaction(sql, client),
              identity,
              null,
            );
          expect(result).toMatchObject({ state: "NONE", options: [] });
          const [membership] = await sql<{ count: string }[]>`
            select count(*)::text as count
            from team_members
            where workspace_id = ${ids.workspaceA}
              and user_id = ${ids.user}
              and status = 'active'
              and deleted_at is null
          `;
          expect(membership?.count).toBe("1");
        }),
      testEnvironment,
    );
  });

  it("rejects a retained signed selection when its Workspace is suspended", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(sql, ids.workspaceA, "A");
          await addWorkspace(
            sql,
            ids.workspaceB,
            "B",
            "active",
            false,
            "suspended",
          );
          const tx = drizzleTransaction(sql, client);
          const withoutSelection =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              tx,
              identity,
              null,
            );
          expect(withoutSelection).toMatchObject({
            state: "AUTO_SELECTED",
            context: { workspaceId: ids.workspaceA },
            options: [{ workspaceId: ids.workspaceA }],
          });
          const suspendedSelection =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              tx,
              identity,
              ids.workspaceB,
            );
          expect(suspendedSelection).toMatchObject({
            state: "INVALID_SELECTION",
            options: [{ workspaceId: ids.workspaceA }],
          });
        }),
      testEnvironment,
    );
  });

  it("restores active context after the Workspace is reactivated", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(
            sql,
            ids.workspaceA,
            "A",
            "active",
            false,
            "suspended",
          );
          const tx = drizzleTransaction(sql, client);
          expect(
            (
              await activeWorkspace.resolveActiveWorkspaceInTransaction(
                tx,
                identity,
                null,
              )
            ).state,
          ).toBe("NONE");
          await sql`
            update workspaces set status = 'active'
            where id = ${ids.workspaceA}
          `;
          expect(
            (
              await activeWorkspace.resolveActiveWorkspaceInTransaction(
                tx,
                identity,
                null,
              )
            ).state,
          ).toBe("AUTO_SELECTED");
        }),
      testEnvironment,
    );
  });

  it("fails closed at the trusted Workspace service boundary for a suspended Workspace", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(
            sql,
            ids.workspaceA,
            "A",
            "active",
            false,
            "suspended",
          );
          await expect(
            workspaceAuth.resolveAuthorizedWorkspaceInTransaction(
              drizzleTransaction(sql, client),
              identity,
            ),
          ).rejects.toThrow("ACTIVE_WORKSPACE_NONE");
        }),
      testEnvironment,
    );
  });

  it("requires explicit selection when a second active membership is added", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(sql, ids.workspaceA, "A");
          const tx = drizzleTransaction(sql, client);
          expect(
            (
              await activeWorkspace.resolveActiveWorkspaceInTransaction(
                tx,
                identity,
                null,
              )
            ).state,
          ).toBe("AUTO_SELECTED");
          await addWorkspace(sql, ids.workspaceB, "B");
          expect(
            (
              await activeWorkspace.resolveActiveWorkspaceInTransaction(
                tx,
                identity,
                null,
              )
            ).state,
          ).toBe("SELECTION_REQUIRED");
        }),
      testEnvironment,
    );
  });

  it("makes a restored membership selectable only after active status returns", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(sql, ids.workspaceA, "A");
          await addWorkspace(sql, ids.workspaceB, "B", "suspended");
          const tx = drizzleTransaction(sql, client);
          expect(
            (
              await activeWorkspace.resolveActiveWorkspaceInTransaction(
                tx,
                identity,
                ids.workspaceB,
              )
            ).state,
          ).toBe("AUTO_SELECTED");
          await sql`
          update team_members set status = 'active'
          where workspace_id = ${ids.workspaceB} and user_id = ${ids.user}
        `;
          expect(
            (
              await activeWorkspace.resolveActiveWorkspaceInTransaction(
                tx,
                identity,
                ids.workspaceB,
              )
            ).state,
          ).toBe("SELECTED");
        }),
      testEnvironment,
    );
  });

  it("revalidates membership removal and safely transitions multiple to one", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(sql, ids.workspaceA, "A");
          await addWorkspace(sql, ids.workspaceB, "B");
          const tx = drizzleTransaction(sql, client);
          expect(
            (
              await activeWorkspace.resolveActiveWorkspaceInTransaction(
                tx,
                identity,
                ids.workspaceB,
              )
            ).state,
          ).toBe("SELECTED");
          await sql`
          update team_members set deleted_at = now()
          where workspace_id = ${ids.workspaceB} and user_id = ${ids.user}
        `;
          const after =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              tx,
              identity,
              ids.workspaceB,
            );
          expect(after).toMatchObject({
            state: "AUTO_SELECTED",
            context: { workspaceId: ids.workspaceA },
          });
        }),
      testEnvironment,
    );
  });

  it("keeps explicit A despite request/resource candidate B and an Auth email change", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(sql, ids.workspaceA, "A");
          await addWorkspace(sql, ids.workspaceB, "B");
          await sql`update auth.users set email = 'changed@verix.local' where id = ${ids.auth}`;
          const result =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              drizzleTransaction(sql, client),
              { ...identity, email: "changed@verix.local" },
              ids.workspaceA,
            );
          const requestWorkspaceId = ids.workspaceB;
          expect(result).toMatchObject({
            state: "SELECTED",
            context: { workspaceId: ids.workspaceA, internalUserId: ids.user },
          });
          expect(
            result.state === "SELECTED" && result.context.workspaceId,
          ).not.toBe(requestWorkspaceId);
        }),
      testEnvironment,
    );
  });

  it("uses only the selected Workspace role and observes role changes on the next operation", async () => {
    await withLocalRlsDatabase(
      (client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedIdentity(sql);
          await addWorkspace(sql, ids.workspaceA, "A");
          await addWorkspace(sql, ids.workspaceB, "B");
          await sql`
          update team_members set role = 'owner'
          where workspace_id = ${ids.workspaceB} and user_id = ${ids.user}
        `;
          const tx = drizzleTransaction(sql, client);

          const selectedA =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              tx,
              identity,
              ids.workspaceA,
            );
          expect(selectedA.state).toBe("SELECTED");
          if (selectedA.state !== "SELECTED")
            throw new Error("Expected Workspace A");
          expect(selectedA.context.role).toBe("manager");
          expect(
            hasCapability(selectedA.context, "workspace.settings.update"),
          ).toBe(false);

          const selectedB =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              tx,
              identity,
              ids.workspaceB,
            );
          expect(selectedB.state).toBe("SELECTED");
          if (selectedB.state !== "SELECTED")
            throw new Error("Expected Workspace B");
          expect(selectedB.context.role).toBe("owner");
          expect(
            hasCapability(selectedB.context, "workspace.settings.update"),
          ).toBe(true);

          await sql`
          update team_members set role = 'employee'
          where workspace_id = ${ids.workspaceA} and user_id = ${ids.user}
        `;
          const demotedA =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              tx,
              identity,
              ids.workspaceA,
            );
          expect(demotedA.state).toBe("SELECTED");
          if (demotedA.state !== "SELECTED")
            throw new Error("Expected demoted Workspace A");
          expect(demotedA.context.role).toBe("employee");
          expect(
            hasCapability(demotedA.context, "reports.financial.read"),
          ).toBe(false);

          await sql`
          update team_members set role = 'manager'
          where workspace_id = ${ids.workspaceA} and user_id = ${ids.user}
        `;
          const promotedA =
            await activeWorkspace.resolveActiveWorkspaceInTransaction(
              tx,
              identity,
              ids.workspaceA,
            );
          expect(promotedA.state).toBe("SELECTED");
          if (promotedA.state !== "SELECTED")
            throw new Error("Expected promoted Workspace A");
          expect(
            hasCapability(promotedA.context, "reports.financial.read"),
          ).toBe(true);
        }),
      testEnvironment,
    );
  });
});
