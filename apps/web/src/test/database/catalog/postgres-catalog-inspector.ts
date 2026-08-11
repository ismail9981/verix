import type { TestDatabaseClient } from "../test-database";
import type {
  CatalogColumn,
  CatalogConstraint,
  CatalogFunction,
  CatalogGrant,
  CatalogIndex,
  CatalogManifest,
  CatalogPolicy,
  CatalogTrigger,
} from "./catalog-manifest";
import { normalizeCatalogManifest } from "./catalog-normalize";
import { classifyFunctionOwnerTrust } from "./function-owner-trust";

const DELETE_ACTIONS: Readonly<Record<string, string>> = {
  a: "no action",
  r: "restrict",
  c: "cascade",
  n: "set null",
  d: "set default",
};

const UPDATE_ACTIONS = DELETE_ACTIONS;

interface ColumnRow {
  schema_name: string;
  table_name: string;
  column_name: string;
  logical_type: string;
  not_null: boolean;
  default_expression: string | null;
  identity_kind: string;
  generated_kind: string;
  ordinal: number;
}

interface EnumRow {
  schema_name: string;
  enum_name: string;
  enum_value: string;
  sort_order: number;
}

interface ConstraintRow {
  schema_name: string;
  table_name: string;
  constraint_name: string;
  constraint_type: string;
  columns: string[] | null;
  referenced_schema: string | null;
  referenced_table: string | null;
  referenced_columns: string[] | null;
  update_action: string;
  delete_action: string;
  definition: string | null;
  deferrable: boolean;
  initially_deferred: boolean;
  validated: boolean;
}

interface IndexRow {
  schema_name: string;
  table_name: string;
  index_name: string;
  is_unique: boolean;
  method_name: string;
  keys: string[];
  predicate: string | null;
}

interface FunctionRow {
  schema_name: string;
  function_name: string;
  arguments: string;
  return_type: string;
  language_name: string;
  volatility: string;
  security_definer: boolean;
  owner_role: string;
  owner_can_login: boolean;
  owner_superuser: boolean;
  owner_bypass_rls: boolean;
  configuration: string[] | null;
  body: string;
}

interface TriggerRow {
  schema_name: string;
  table_name: string;
  trigger_name: string;
  timing: string;
  events: string[];
  orientation: string;
  function_schema: string;
  function_name: string;
  condition: string | null;
}

interface RlsRow {
  schema_name: string;
  table_name: string;
  enabled: boolean;
  forced: boolean;
}

interface PolicyRow {
  schema_name: string;
  table_name: string;
  policy_name: string;
  permissive: string;
  command: string;
  roles: string[];
  using_expression: string | null;
  check_expression: string | null;
}

interface GrantRow {
  target_kind: "table" | "function";
  schema_name: string;
  object_name: string;
  grantee: "PUBLIC" | "anon" | "authenticated" | "service_role";
  privilege: string;
}

function identityKind(value: string): CatalogColumn["identity"] {
  if (value === "a") return "always";
  if (value === "d") return "by_default";
  return null;
}

function generatedKind(value: string): CatalogColumn["generated"] {
  return value === "s" ? "stored" : null;
}

function constraintType(value: string): CatalogConstraint["type"] {
  const types: Readonly<Record<string, CatalogConstraint["type"]>> = {
    p: "primary_key",
    u: "unique",
    f: "foreign_key",
    c: "check",
    x: "exclusion",
  };
  const result = types[value];
  if (!result) throw new Error("Unsupported PostgreSQL constraint type.");
  return result;
}

function volatility(value: string): CatalogFunction["volatility"] {
  if (value === "i") return "immutable";
  if (value === "s") return "stable";
  return "volatile";
}

function triggerTiming(value: string): CatalogTrigger["timing"] {
  if (value === "BEFORE") return "before";
  if (value === "AFTER") return "after";
  return "instead_of";
}

function policyCommand(value: string): CatalogPolicy["command"] {
  const normalized = value.toLowerCase();
  if (
    normalized === "all" ||
    normalized === "select" ||
    normalized === "insert" ||
    normalized === "update" ||
    normalized === "delete"
  ) {
    return normalized;
  }
  throw new Error("Unsupported PostgreSQL policy command.");
}

/**
 * Reads only pg_catalog/information_schema and never issues DDL or DML.
 * The caller must establish the B1-guarded connection before invoking it.
 */
export async function inspectPostgresCatalog(
  client: TestDatabaseClient,
  scope: CatalogManifest["scope"] = "pre-sprint-1",
): Promise<CatalogManifest> {
  const [
    columns,
    enums,
    constraints,
    indexes,
    functions,
    triggers,
    rls,
    policies,
    grants,
  ] = await Promise.all([
    client<ColumnRow[]>`
        select n.nspname as schema_name, c.relname as table_name,
          a.attname as column_name, format_type(a.atttypid, a.atttypmod) as logical_type,
          a.attnotnull as not_null, pg_get_expr(d.adbin, d.adrelid) as default_expression,
          a.attidentity as identity_kind, a.attgenerated as generated_kind,
          a.attnum::int as ordinal
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid and c.relkind in ('r', 'p')
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped
        order by n.nspname, c.relname, a.attnum
      `,
    client<EnumRow[]>`
        select n.nspname as schema_name, t.typname as enum_name,
          e.enumlabel as enum_value, e.enumsortorder::float8 as sort_order
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        join pg_enum e on e.enumtypid = t.oid
        where n.nspname = 'public'
        order by n.nspname, t.typname, e.enumsortorder
      `,
    client<ConstraintRow[]>`
        select n.nspname as schema_name, rel.relname as table_name,
          c.conname as constraint_name, c.contype as constraint_type,
          (select array_agg(a.attname order by keys.ordinality)
             from unnest(c.conkey) with ordinality as keys(attnum, ordinality)
             join pg_attribute a on a.attrelid = c.conrelid and a.attnum = keys.attnum) as columns,
          rn.nspname as referenced_schema, rrel.relname as referenced_table,
          (select array_agg(a.attname order by keys.ordinality)
             from unnest(c.confkey) with ordinality as keys(attnum, ordinality)
             join pg_attribute a on a.attrelid = c.confrelid and a.attnum = keys.attnum) as referenced_columns,
          c.confupdtype as update_action, c.confdeltype as delete_action,
          case when c.contype = 'c' then pg_get_expr(c.conbin, c.conrelid)
               when c.contype = 'x' then pg_get_constraintdef(c.oid, true)
               else null end as definition,
          c.condeferrable as deferrable, c.condeferred as initially_deferred,
          c.convalidated as validated
        from pg_constraint c
        join pg_class rel on rel.oid = c.conrelid
        join pg_namespace n on n.oid = rel.relnamespace
        left join pg_class rrel on rrel.oid = c.confrelid
        left join pg_namespace rn on rn.oid = rrel.relnamespace
        where n.nspname = 'public' and c.contype in ('p', 'u', 'f', 'c', 'x')
        order by n.nspname, rel.relname, c.conname
      `,
    client<IndexRow[]>`
        select n.nspname as schema_name, rel.relname as table_name,
          idx.relname as index_name, i.indisunique as is_unique, am.amname as method_name,
          array(select pg_get_indexdef(i.indexrelid, key_position, true)
            from generate_series(1, i.indnkeyatts) key_position order by key_position) as keys,
          pg_get_expr(i.indpred, i.indrelid) as predicate
        from pg_index i
        join pg_class idx on idx.oid = i.indexrelid
        join pg_class rel on rel.oid = i.indrelid
        join pg_namespace n on n.oid = rel.relnamespace
        join pg_am am on am.oid = idx.relam
        where n.nspname = 'public' and not i.indisprimary
          and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
        order by n.nspname, rel.relname, idx.relname
      `,
    client<FunctionRow[]>`
        select n.nspname as schema_name, p.proname as function_name,
          pg_get_function_identity_arguments(p.oid) as arguments,
          pg_get_function_result(p.oid) as return_type, l.lanname as language_name,
          p.provolatile as volatility, p.prosecdef as security_definer,
          owner.rolname as owner_role, owner.rolcanlogin as owner_can_login,
          owner.rolsuper as owner_superuser, owner.rolbypassrls as owner_bypass_rls,
          p.proconfig as configuration, p.prosrc as body
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        join pg_language l on l.oid = p.prolang
        join pg_roles owner on owner.oid = p.proowner
        where n.nspname = 'public'
          and not exists (
            select 1 from pg_depend d
            where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
          )
        order by n.nspname, p.proname, arguments
      `,
    client<TriggerRow[]>`
        select n.nspname as schema_name, rel.relname as table_name,
          t.tgname as trigger_name,
          case when (t.tgtype & 2) <> 0 then 'BEFORE'
               when (t.tgtype & 64) <> 0 then 'INSTEAD OF' else 'AFTER' end as timing,
          array_remove(array[
            case when (t.tgtype & 4) <> 0 then 'insert' end,
            case when (t.tgtype & 8) <> 0 then 'delete' end,
            case when (t.tgtype & 16) <> 0 then 'update' end,
            case when (t.tgtype & 32) <> 0 then 'truncate' end
          ], null) as events,
          case when (t.tgtype & 1) <> 0 then 'row' else 'statement' end as orientation,
          fnn.nspname as function_schema, fn.proname as function_name,
          pg_get_expr(t.tgqual, t.tgrelid) as condition
        from pg_trigger t
        join pg_class rel on rel.oid = t.tgrelid
        join pg_namespace n on n.oid = rel.relnamespace
        join pg_proc fn on fn.oid = t.tgfoid
        join pg_namespace fnn on fnn.oid = fn.pronamespace
        where n.nspname = 'public' and not t.tgisinternal
        order by n.nspname, rel.relname, t.tgname
      `,
    client<RlsRow[]>`
        select n.nspname as schema_name, c.relname as table_name,
          c.relrowsecurity as enabled, c.relforcerowsecurity as forced
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p')
        order by n.nspname, c.relname
      `,
    client<PolicyRow[]>`
        select schemaname as schema_name, tablename as table_name,
          policyname as policy_name, permissive, cmd as command, roles,
          qual as using_expression, with_check as check_expression
        from pg_policies where schemaname = 'public'
        order by schemaname, tablename, policyname
      `,
    client<GrantRow[]>`
        select 'table'::text as target_kind, table_schema as schema_name,
          table_name as object_name, grantee, privilege_type as privilege
        from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
        union all
        select 'function'::text as target_kind, n.nspname as schema_name,
          p.proname as object_name, coalesce(grantee.rolname, 'PUBLIC') as grantee,
          acl.privilege_type::text as privilege
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        left join pg_roles grantee on grantee.oid = acl.grantee
        where n.nspname = 'public'
          and coalesce(grantee.rolname, 'PUBLIC') in ('PUBLIC', 'anon', 'authenticated', 'service_role')
          and not exists (
            select 1 from pg_depend d
            where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
          )
        order by target_kind, schema_name, object_name, grantee, privilege
      `,
  ]);

  const tableMap = new Map<string, CatalogColumn[]>();
  for (const row of columns) {
    const key = `${row.schema_name}.${row.table_name}`;
    const values = tableMap.get(key) ?? [];
    values.push({
      name: row.column_name,
      type: row.logical_type,
      nullable: !row.not_null,
      default: row.default_expression,
      identity: identityKind(row.identity_kind),
      generated: generatedKind(row.generated_kind),
    });
    tableMap.set(key, values);
  }

  const enumMap = new Map<string, string[]>();
  for (const row of enums) {
    const key = `${row.schema_name}.${row.enum_name}`;
    enumMap.set(key, [...(enumMap.get(key) ?? []), row.enum_value]);
  }

  return normalizeCatalogManifest({
    manifestVersion: 1,
    scope,
    tables: [...tableMap.entries()].map(([identifier, tableColumns]) => {
      const [schema = "public", name = ""] = identifier.split(".");
      return { schema, name, ownership: "verix_owned", columns: tableColumns };
    }),
    enums: [...enumMap.entries()].map(([identifier, values]) => {
      const [schema = "public", name = ""] = identifier.split(".");
      return { schema, name, ownership: "verix_owned", values };
    }),
    constraints: constraints.map((row): CatalogConstraint => ({
      schema: row.schema_name,
      table: row.table_name,
      name: row.constraint_name,
      ownership: "verix_owned",
      type: constraintType(row.constraint_type),
      columns: row.columns ?? [],
      referencedSchema: row.referenced_schema,
      referencedTable: row.referenced_table,
      referencedColumns: row.referenced_columns ?? [],
      onUpdate:
        row.constraint_type === "f"
          ? (UPDATE_ACTIONS[row.update_action] ?? null)
          : null,
      onDelete:
        row.constraint_type === "f"
          ? (DELETE_ACTIONS[row.delete_action] ?? null)
          : null,
      definition: row.definition,
      deferrable: row.deferrable,
      initiallyDeferred: row.initially_deferred,
      validated: row.validated,
    })),
    indexes: indexes.map((row): CatalogIndex => ({
      schema: row.schema_name,
      table: row.table_name,
      name: row.index_name,
      ownership: "verix_owned",
      unique: row.is_unique,
      method: row.method_name,
      keys: row.keys,
      predicate: row.predicate,
    })),
    functions: functions.map((row): CatalogFunction => ({
      schema: row.schema_name,
      name: row.function_name,
      ownership: "verix_owned",
      arguments: row.arguments,
      returnType: row.return_type,
      language: row.language_name,
      volatility: volatility(row.volatility),
      securityDefiner: row.security_definer,
      ownerTrust: classifyFunctionOwnerTrust({
        securityDefiner: row.security_definer,
        roleName: row.owner_role,
        canLogin: row.owner_can_login,
        superuser: row.owner_superuser,
        bypassRls: row.owner_bypass_rls,
      }),
      configuration: row.configuration ?? [],
      body: row.body,
    })),
    triggers: triggers.map((row): CatalogTrigger => ({
      schema: row.schema_name,
      table: row.table_name,
      name: row.trigger_name,
      ownership: "verix_owned",
      timing: triggerTiming(row.timing),
      events: row.events,
      orientation: row.orientation === "row" ? "row" : "statement",
      functionSchema: row.function_schema,
      functionName: row.function_name,
      condition: row.condition,
    })),
    rls: rls.map((row) => ({
      schema: row.schema_name,
      table: row.table_name,
      ownership: "verix_owned" as const,
      enabled: row.enabled,
      forced: row.forced,
    })),
    policies: policies.map((row): CatalogPolicy => ({
      schema: row.schema_name,
      table: row.table_name,
      name: row.policy_name,
      ownership: "verix_owned",
      permissive: row.permissive === "PERMISSIVE",
      command: policyCommand(row.command),
      roles: row.roles,
      using: row.using_expression,
      withCheck: row.check_expression,
    })),
    grants: grants.map((row): CatalogGrant => ({
      targetKind: row.target_kind,
      schema: row.schema_name,
      object: row.object_name,
      ownership: "verix_owned",
      grantee: row.grantee,
      privilege: row.privilege.toLowerCase(),
    })),
    ambiguities: [],
    legacyObjects: [],
  });
}
