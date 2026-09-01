import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCanonicalMigrationIdentities } from "../src/test/database/canonical-adoption";
import { compareCatalogManifests } from "../src/test/database/catalog/catalog-compare";
import type { CatalogManifest } from "../src/test/database/catalog/catalog-manifest";
import { fingerprintCatalogManifest } from "../src/test/database/catalog/catalog-normalize";
import { inspectPostgresCatalog } from "../src/test/database/catalog/postgres-catalog-inspector";
import { withTestDatabase } from "../src/test/database/test-database";

const appDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const expected = JSON.parse(
  await readFile(
    resolve(
      appDirectory,
      "src/test/database/catalog/manifests/post-s2-b1.json",
    ),
    "utf8",
  ),
) as CatalogManifest;
const migrations = await readCanonicalMigrationIdentities(appDirectory);
const platformMigration = migrations.find(
  ({ tag }) => tag === "0006_platform_admin_foundation",
);
if (!platformMigration) throw new Error("B2 migration metadata is missing.");

const result = await withTestDatabase(async (client) => {
  const [observed, ledger, acl, policies] = await Promise.all([
    inspectPostgresCatalog(client, "post-s2-b1"),
    client<Array<{ hash: string; created_at: string }>>`
      select hash, created_at::text as created_at
      from drizzle.__drizzle_migrations order by created_at, id
    `,
    client<
      Array<{
        role_name: string;
        admins_crud: boolean;
        audit_crud: boolean;
        workspace_helper_execute: boolean;
        immutable_helper_execute: boolean;
        append_helper_execute: boolean;
      }>
    >`
      select role_name,
        (has_table_privilege(role_name, 'public.platform_admins', 'select')
          or has_table_privilege(role_name, 'public.platform_admins', 'insert')
          or has_table_privilege(role_name, 'public.platform_admins', 'update')
          or has_table_privilege(role_name, 'public.platform_admins', 'delete'))
          as admins_crud,
        (has_table_privilege(role_name, 'public.platform_audit_events', 'select')
          or has_table_privilege(role_name, 'public.platform_audit_events', 'insert')
          or has_table_privilege(role_name, 'public.platform_audit_events', 'update')
          or has_table_privilege(role_name, 'public.platform_audit_events', 'delete'))
          as audit_crud,
        has_function_privilege(role_name,
          'public.current_workspace_ids()', 'execute') as workspace_helper_execute,
        has_function_privilege(role_name,
          'public.enforce_platform_admin_auth_user_id_immutability()', 'execute')
          as immutable_helper_execute,
        has_function_privilege(role_name,
          'public.prevent_platform_audit_event_mutation()', 'execute')
          as append_helper_execute
      from unnest(array['anon', 'authenticated', 'service_role']) as role_name
      order by role_name
    `,
    client<
      Array<{ table_name: string; policy_count: number; rls_enabled: boolean }>
    >`
      select c.relname as table_name,
        count(p.policyname)::int as policy_count,
        c.relrowsecurity as rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_policies p
        on p.schemaname = n.nspname and p.tablename = c.relname
      where n.nspname = 'public'
        and c.relname in ('platform_admins', 'platform_audit_events')
      group by c.relname, c.relrowsecurity
      order by c.relname
    `,
  ]);
  const comparison = compareCatalogManifests(expected, observed);
  const expectedFingerprint = fingerprintCatalogManifest(expected).value;
  const observedFingerprint = fingerprintCatalogManifest(observed).value;
  const lastLedgerRow = ledger.at(-1);
  const denied = acl.every(
    (row) =>
      !row.admins_crud &&
      !row.audit_crud &&
      !row.workspace_helper_execute &&
      !row.immutable_helper_execute &&
      !row.append_helper_execute,
  );
  const isolated =
    policies.length === 2 &&
    policies.every(
      ({ policy_count, rls_enabled }) => policy_count === 0 && rls_enabled,
    );

  if (
    comparison.adoptionDecision !== "ADOPTABLE" ||
    observedFingerprint !== expectedFingerprint ||
    ledger.length !== migrations.length ||
    lastLedgerRow?.hash !== platformMigration.hash ||
    lastLedgerRow.created_at !== String(platformMigration.createdAt) ||
    observed.grants.length !== 0 ||
    !denied ||
    !isolated
  ) {
    throw new Error(
      "Post-0006 catalog, ledger, RLS isolation, or ACL verification failed.",
    );
  }

  return {
    migrationCount: ledger.length,
    tableCount: observed.tables.length,
    enumCount: observed.enums.length,
    indexCount: observed.indexes.length,
    constraintCount: observed.constraints.length,
    functionCount: observed.functions.length,
    triggerCount: observed.triggers.length,
    rlsEnabledCount: observed.rls.filter(({ enabled }) => enabled).length,
    policyCount: observed.policies.length,
    grantCount: observed.grants.length,
    aclRolesVerified: acl.map(({ role_name }) => role_name),
    fingerprint: observedFingerprint,
    adoptionDecision: comparison.adoptionDecision,
  };
});

console.log(JSON.stringify(result));
