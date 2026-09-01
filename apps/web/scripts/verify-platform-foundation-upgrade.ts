import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCanonicalMigrationIdentities } from "../src/test/database/canonical-adoption";
import { runCanonicalMigrationCommand } from "../src/test/database/migration-bootstrap";
import {
  assertSafeTestDatabase,
  withTestDatabase,
} from "../src/test/database/test-database";

type FixtureSnapshot = {
  users: unknown;
  workspaces: unknown;
  memberships: unknown;
};

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const config = assertSafeTestDatabase();
if (config.targetKind !== "disposable_database") {
  throw new Error(
    "B2 upgrade verification requires a disposable local database.",
  );
}

const migrations = await readCanonicalMigrationIdentities(appDirectory);
const previousMigration = migrations.find(
  ({ tag }) => tag === "0005_postgrest_acl_hardening",
);
const platformMigration = migrations.find(
  ({ tag }) => tag === "0006_platform_admin_foundation",
);
if (!previousMigration || !platformMigration) {
  throw new Error("B2 upgrade migration identities are incomplete.");
}

const before = await withTestDatabase(async (client) => {
  const [statusColumn, ledger, fixture] = await Promise.all([
    client<Array<{ exists: boolean }>>`
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'workspaces'
          and column_name = 'status'
      ) as exists
    `,
    client<Array<{ hash: string; created_at: string }>>`
      select hash, created_at::text as created_at
      from drizzle.__drizzle_migrations order by created_at, id
    `,
    client<Array<FixtureSnapshot>>`
      select
        (select jsonb_agg(jsonb_build_object(
          'id', id, 'auth_user_id', auth_user_id, 'email', email,
          'deleted_at', deleted_at
        ) order by id) from users) as users,
        (select jsonb_agg(jsonb_build_object(
          'id', id, 'owner_id', owner_id, 'name', name, 'slug', slug,
          'deleted_at', deleted_at
        ) order by id) from workspaces) as workspaces,
        (select jsonb_agg(jsonb_build_object(
          'id', id, 'workspace_id', workspace_id, 'user_id', user_id,
          'role', role, 'status', status, 'deleted_at', deleted_at
        ) order by id) from team_members) as memberships
    `,
  ]);
  const last = ledger.at(-1);
  if (
    statusColumn[0]?.exists ||
    ledger.length !== 6 ||
    last?.hash !== previousMigration.hash ||
    last.created_at !== String(previousMigration.createdAt) ||
    !fixture[0]?.users ||
    !fixture[0]?.workspaces ||
    !fixture[0]?.memberships
  ) {
    throw new Error(
      "B2 upgrade verification requires representative exact post-0005 fixtures.",
    );
  }
  return fixture[0];
});

const migrationResult = await runCanonicalMigrationCommand(appDirectory);
if (migrationResult.exitCode !== 0) {
  throw new Error("Applying 0006 to the disposable post-0005 database failed.");
}

const result = await withTestDatabase(async (client) => {
  const [ledger, fixture, status, platform] = await Promise.all([
    client<Array<{ hash: string; created_at: string }>>`
      select hash, created_at::text as created_at
      from drizzle.__drizzle_migrations order by created_at, id
    `,
    client<Array<FixtureSnapshot>>`
      select
        (select jsonb_agg(jsonb_build_object(
          'id', id, 'auth_user_id', auth_user_id, 'email', email,
          'deleted_at', deleted_at
        ) order by id) from users) as users,
        (select jsonb_agg(jsonb_build_object(
          'id', id, 'owner_id', owner_id, 'name', name, 'slug', slug,
          'deleted_at', deleted_at
        ) order by id) from workspaces) as workspaces,
        (select jsonb_agg(jsonb_build_object(
          'id', id, 'workspace_id', workspace_id, 'user_id', user_id,
          'role', role, 'status', status, 'deleted_at', deleted_at
        ) order by id) from team_members) as memberships
    `,
    client<Array<{ total: number; active: number }>>`
      select count(*)::int as total,
        count(*) filter (where status = 'active')::int as active
      from workspaces
    `,
    client<Array<{ admins: number; audit_events: number }>>`
      select
        (select count(*)::int from platform_admins) as admins,
        (select count(*)::int from platform_audit_events) as audit_events
    `,
  ]);
  const last = ledger.at(-1);
  const statusRow = status[0];
  const platformRow = platform[0];
  const dataPreserved = JSON.stringify(before) === JSON.stringify(fixture[0]);
  if (
    ledger.length !== migrations.length ||
    last?.hash !== platformMigration.hash ||
    last.created_at !== String(platformMigration.createdAt) ||
    !dataPreserved ||
    !statusRow ||
    statusRow.total !== statusRow.active ||
    !platformRow ||
    platformRow.admins !== 0 ||
    platformRow.audit_events !== 0
  ) {
    throw new Error("B2 post-0005 upgrade verification failed.");
  }
  return {
    migrationCount: ledger.length,
    existingWorkspaceCount: statusRow.total,
    activeWorkspaceCount: statusRow.active,
    existingDataPreserved: dataPreserved,
    platformAdminCount: platformRow.admins,
    platformAuditEventCount: platformRow.audit_events,
  };
});

console.log(JSON.stringify(result));
