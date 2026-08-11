import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { is, SQL, Table } from "drizzle-orm";
import {
  getTableConfig,
  IndexedColumn,
  isPgEnum,
  PgDialect,
  type PgTable,
} from "drizzle-orm/pg-core";
import * as schemaExports from "../../../server/db/schema";
import type {
  CatalogConstraint,
  CatalogFunction,
  CatalogGrant,
  CatalogIndex,
  CatalogManifest,
  CatalogPolicy,
  CatalogTrigger,
  SupabasePrerequisite,
  SupabasePrerequisiteManifest,
} from "./catalog-manifest";
import { normalizeCatalogManifest, normalizeSql } from "./catalog-normalize";

const dialect = new PgDialect();
const RLS_HELPERS = [
  "current_workspace_ids",
  "current_comember_ids",
  "current_conversation_ids",
] as const;
const BILLING_FUNCTIONS = [
  "enforce_invoice_payment_integrity",
  "enforce_payment_immutability",
  "enforce_invoice_line_items_draft_only",
  "sync_invoice_amount_from_line_items",
  "enforce_invoice_reservation_consistency",
  "enforce_invoice_status_transitions",
] as const;

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function renderSql(value: SQL): string {
  const query = dialect.sqlToQuery(value);
  let rendered = query.sql;
  for (let index = query.params.length; index > 0; index -= 1) {
    const parameter = query.params[index - 1];
    const literal =
      typeof parameter === "string"
        ? quoteLiteral(parameter)
        : parameter === null
          ? "null"
          : JSON.stringify(parameter);
    rendered = rendered.replaceAll(`$${index}`, literal);
  }
  return normalizeSql(rendered) ?? "";
}

function renderDefault(value: unknown, logicalType: string): string | null {
  if (value === undefined) return null;
  if (is(value, SQL)) return renderSql(value);
  if (typeof value === "string") return `${quoteLiteral(value)}::${logicalType}`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.length === 0) return `'{}'::${logicalType}`;
  if (
    (logicalType === "json" || logicalType === "jsonb") &&
    typeof value === "object" &&
    value !== null
  ) {
    return `${quoteLiteral(JSON.stringify(value))}::${logicalType}`;
  }
  return normalizeSql(JSON.stringify(value));
}

function tableObjects(): PgTable[] {
  const values: unknown[] = Object.values(schemaExports);
  return values
    .filter((value) => is(value, Table))
    .map((value) => value as PgTable)
    .sort((left, right) =>
      getTableConfig(left).name.localeCompare(getTableConfig(right).name, "en"),
    );
}

function enumObjects(): Array<{ enumName: string; enumValues: string[] }> {
  const values: unknown[] = Object.values(schemaExports);
  return values
    .filter((value) => isPgEnum(value))
    .map((value) => value as ReturnType<typeof Object.values>[number] & {
      enumName: string;
      enumValues: string[];
    })
    .map((value) => ({ enumName: value.enumName, enumValues: [...value.enumValues] }))
    .sort((left, right) => left.enumName.localeCompare(right.enumName, "en"));
}

function schemaConstraints(tables: readonly PgTable[]): CatalogConstraint[] {
  const constraints: CatalogConstraint[] = [];

  for (const table of tables) {
    const config = getTableConfig(table);
    const tableSchema = config.schema ?? "public";

    for (const column of config.columns) {
      if (column.primary) {
        constraints.push({
          schema: tableSchema,
          table: config.name,
          name: `${config.name}_pkey`,
          ownership: "verix_owned",
          type: "primary_key",
          columns: [column.name],
          referencedSchema: null,
          referencedTable: null,
          referencedColumns: [],
          onUpdate: null,
          onDelete: null,
          definition: null,
          deferrable: false,
          initiallyDeferred: false,
          validated: true,
        });
      }
      if (column.isUnique) {
        constraints.push({
          schema: tableSchema,
          table: config.name,
          name: column.uniqueName ?? `${config.name}_${column.name}_unique`,
          ownership: "verix_owned",
          type: "unique",
          columns: [column.name],
          referencedSchema: null,
          referencedTable: null,
          referencedColumns: [],
          onUpdate: null,
          onDelete: null,
          definition: null,
          deferrable: false,
          initiallyDeferred: false,
          validated: true,
        });
      }
    }

    for (const primaryKey of config.primaryKeys) {
      constraints.push({
        schema: tableSchema,
        table: config.name,
        name: primaryKey.getName(),
        ownership: "verix_owned",
        type: "primary_key",
        columns: primaryKey.columns.map((column) => column.name),
        referencedSchema: null,
        referencedTable: null,
        referencedColumns: [],
        onUpdate: null,
        onDelete: null,
        definition: null,
        deferrable: false,
        initiallyDeferred: false,
        validated: true,
      });
    }

    for (const unique of config.uniqueConstraints) {
      constraints.push({
        schema: tableSchema,
        table: config.name,
        name: unique.getName() ?? `${config.name}_${unique.columns.map((c) => c.name).join("_")}_unique`,
        ownership: "verix_owned",
        type: "unique",
        columns: unique.columns.map((column) => column.name),
        referencedSchema: null,
        referencedTable: null,
        referencedColumns: [],
        onUpdate: null,
        onDelete: null,
        definition: unique.nullsNotDistinct ? "nulls not distinct" : null,
        deferrable: false,
        initiallyDeferred: false,
        validated: true,
      });
    }

    for (const foreignKey of config.foreignKeys) {
      const reference = foreignKey.reference();
      const foreignConfig = getTableConfig(reference.foreignTable);
      constraints.push({
        schema: tableSchema,
        table: config.name,
        name: foreignKey.getName(),
        ownership: "verix_owned",
        type: "foreign_key",
        columns: reference.columns.map((column) => column.name),
        referencedSchema: foreignConfig.schema ?? "public",
        referencedTable: foreignConfig.name,
        referencedColumns: reference.foreignColumns.map((column) => column.name),
        onUpdate: foreignKey.onUpdate ?? "no action",
        onDelete: foreignKey.onDelete ?? "no action",
        definition: null,
        deferrable: false,
        initiallyDeferred: false,
        validated: true,
      });
    }

    for (const check of config.checks) {
      constraints.push({
        schema: tableSchema,
        table: config.name,
        name: check.name,
        ownership: "verix_owned",
        type: "check",
        columns: [],
        referencedSchema: null,
        referencedTable: null,
        referencedColumns: [],
        onUpdate: null,
        onDelete: null,
        definition: renderSql(check.value),
        deferrable: false,
        initiallyDeferred: false,
        validated: true,
      });
    }
  }

  constraints.push(
    {
      schema: "public",
      table: "sites",
      name: "sites_published_version_id_fk",
      ownership: "verix_owned",
      type: "foreign_key",
      columns: ["published_version_id"],
      referencedSchema: "public",
      referencedTable: "site_versions",
      referencedColumns: ["id"],
      onUpdate: "no action",
      onDelete: "set null",
      definition: null,
      deferrable: false,
      initiallyDeferred: false,
      validated: true,
    },
    {
      schema: "public",
      table: "reservations",
      name: "reservations_no_overlap_excl",
      ownership: "verix_owned",
      type: "exclusion",
      columns: ["unit_id"],
      referencedSchema: null,
      referencedTable: null,
      referencedColumns: [],
      onUpdate: null,
      onDelete: null,
      definition:
        "exclude using gist (unit_id with =, daterange(check_in_date, check_out_date, '[)') with &&) where (status not in ('cancelled', 'no_show') and deleted_at is null)",
      deferrable: false,
      initiallyDeferred: false,
      validated: true,
    },
  );

  return constraints;
}

function schemaIndexes(tables: readonly PgTable[]): CatalogIndex[] {
  return tables.flatMap((table) => {
    const config = getTableConfig(table);
    return config.indexes.map((index): CatalogIndex => ({
      schema: config.schema ?? "public",
      table: config.name,
      name: index.config.name ?? `${config.name}_unnamed_index`,
      ownership: "verix_owned",
      unique: index.config.unique,
      method: index.config.method ?? "btree",
      keys: index.config.columns.map((column) => {
        if (is(column, SQL)) return renderSql(column);
        if (!is(column, IndexedColumn)) {
          throw new Error("Unsupported Drizzle index expression.");
        }
        const name = column.name ?? column.type;
        const order = column.indexConfig.order === "desc" ? " desc" : "";
        const nulls =
          column.indexConfig.nulls === "first" ? " nulls first" : "";
        const opClass = column.indexConfig.opClass
          ? ` ${column.indexConfig.opClass}`
          : "";
        return `${name}${opClass}${order}${nulls}`;
      }),
      predicate: index.config.where ? renderSql(index.config.where) : null,
    }));
  });
}

function functionBody(source: string, name: string): string {
  const startPattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+(?:public\\.)?${name}\\s*\\(`,
    "i",
  );
  const startMatch = startPattern.exec(source);
  if (!startMatch) throw new Error(`Missing canonical function source for ${name}.`);
  const remainder = source.slice(startMatch.index);
  const delimiterMatch = /\$[a-zA-Z0-9_]*\$/.exec(remainder);
  if (!delimiterMatch) throw new Error(`Missing function body delimiter for ${name}.`);
  const delimiter = delimiterMatch[0];
  const bodyStart = (delimiterMatch.index ?? 0) + delimiter.length;
  const bodyEnd = remainder.indexOf(delimiter, bodyStart);
  if (bodyEnd < 0) throw new Error(`Unterminated function body for ${name}.`);
  return normalizeSql(remainder.slice(bodyStart, bodyEnd)) ?? "";
}

function canonicalFunctions(
  rlsSql: string,
  billingSql: string,
  billingImmutabilitySql: string,
): CatalogFunction[] {
  const helpers = RLS_HELPERS.map((name): CatalogFunction => ({
    schema: "public",
    name,
    ownership: "verix_owned",
    arguments: "",
    returnType: "setof uuid",
    language: "sql",
    volatility: "stable",
    securityDefiner: true,
    ownerTrust: "trusted_privileged_owner",
    configuration: ["search_path=public"],
    body: functionBody(rlsSql, name),
  }));
  const billing = BILLING_FUNCTIONS.map((name): CatalogFunction => ({
    schema: "public",
    name,
    ownership: "verix_owned",
    arguments: "",
    returnType: "trigger",
    language: "plpgsql",
    volatility: "volatile",
    securityDefiner: false,
    ownerTrust: "not_applicable",
    configuration: [],
    body: functionBody(
      name === "enforce_payment_immutability"
        ? billingImmutabilitySql
        : billingSql,
      name,
    ),
  }));
  return [...helpers, ...billing];
}

const BILLING_TRIGGERS: readonly CatalogTrigger[] = [
  {
    schema: "public",
    table: "payments",
    name: "enforce_invoice_payment_integrity_trg",
    ownership: "verix_owned",
    timing: "before",
    events: ["insert"],
    orientation: "row",
    functionSchema: "public",
    functionName: "enforce_invoice_payment_integrity",
    condition: null,
  },
  {
    schema: "public",
    table: "payments",
    name: "enforce_payment_immutability_trg",
    ownership: "verix_owned",
    timing: "before",
    events: ["update"],
    orientation: "row",
    functionSchema: "public",
    functionName: "enforce_payment_immutability",
    condition: "old.invoice_id is not null",
  },
  {
    schema: "public",
    table: "invoice_line_items",
    name: "enforce_invoice_line_items_draft_only_trg",
    ownership: "verix_owned",
    timing: "before",
    events: ["insert", "update", "delete"],
    orientation: "row",
    functionSchema: "public",
    functionName: "enforce_invoice_line_items_draft_only",
    condition: null,
  },
  {
    schema: "public",
    table: "invoice_line_items",
    name: "sync_invoice_amount_from_line_items_trg",
    ownership: "verix_owned",
    timing: "after",
    events: ["insert", "update", "delete"],
    orientation: "row",
    functionSchema: "public",
    functionName: "sync_invoice_amount_from_line_items",
    condition: null,
  },
  {
    schema: "public",
    table: "invoices",
    name: "enforce_invoice_reservation_consistency_trg",
    ownership: "verix_owned",
    timing: "before",
    events: ["insert", "update"],
    orientation: "row",
    functionSchema: "public",
    functionName: "enforce_invoice_reservation_consistency",
    condition: null,
  },
  {
    schema: "public",
    table: "invoices",
    name: "enforce_invoice_status_transitions_trg",
    ownership: "verix_owned",
    timing: "before",
    events: ["update"],
    orientation: "row",
    functionSchema: "public",
    functionName: "enforce_invoice_status_transitions",
    condition: null,
  },
];

function workspacePolicyExpression(table: string): string {
  if (table === "workspaces") return "id in (select public.current_workspace_ids())";
  if (table === "users") return "id in (select public.current_comember_ids())";
  if (table === "ai_messages") {
    return "conversation_id in (select public.current_conversation_ids())";
  }
  return "workspace_id in (select public.current_workspace_ids())";
}

function canonicalPolicies(tableNames: readonly string[]): CatalogPolicy[] {
  return tableNames.map((table): CatalogPolicy => {
    const expression = workspacePolicyExpression(table);
    return {
      schema: "public",
      table,
      name: "workspace_access",
      ownership: "verix_owned",
      permissive: true,
      command: "all",
      roles: ["authenticated"],
      using: expression,
      withCheck: expression,
    };
  });
}

function canonicalGrants(tableNames: readonly string[]): CatalogGrant[] {
  const tableGrants = tableNames.flatMap((object) =>
    ["select", "insert", "update", "delete"].map(
      (privilege): CatalogGrant => ({
        targetKind: "table",
        schema: "public",
        object,
        ownership: "verix_owned",
        grantee: "authenticated",
        privilege,
      }),
    ),
  );
  const functionGrants = RLS_HELPERS.flatMap((object) =>
    (["authenticated", "anon"] as const).map(
      (grantee): CatalogGrant => ({
        targetKind: "function",
        schema: "public",
        object,
        ownership: "verix_owned",
        grantee,
        privilege: "execute",
      }),
    ),
  );
  return [...tableGrants, ...functionGrants];
}

export async function buildRepositoryCanonicalManifest(
  appDirectory: string,
): Promise<CatalogManifest> {
  const [rlsSql, billingSql, billingImmutabilitySql] = await Promise.all([
    readFile(resolve(appDirectory, "src/server/db/rls.sql"), "utf8"),
    readFile(resolve(appDirectory, "drizzle/0014_billing.sql"), "utf8"),
    readFile(resolve(appDirectory, "drizzle/0016_billing_actor_immutability.sql"), "utf8"),
  ]);
  const tables = tableObjects();
  const tableNames = tables.map((table) => getTableConfig(table).name);

  return normalizeCatalogManifest({
    manifestVersion: 1,
    scope: "pre-sprint-1",
    tables: tables.map((table) => {
      const config = getTableConfig(table);
      return {
        schema: config.schema ?? "public",
        name: config.name,
        ownership: "verix_owned" as const,
        columns: config.columns.map((column) => ({
          name: column.name,
          type: column.getSQLType(),
          nullable: !column.notNull,
          default: renderDefault(column.default, column.getSQLType()),
          identity: null,
          generated: null,
        })),
      };
    }),
    enums: enumObjects().map((value) => ({
      schema: "public",
      name: value.enumName,
      ownership: "verix_owned" as const,
      values: value.enumValues,
    })),
    indexes: schemaIndexes(tables),
    constraints: schemaConstraints(tables),
    functions: canonicalFunctions(rlsSql, billingSql, billingImmutabilitySql),
    triggers: BILLING_TRIGGERS,
    rls: tableNames.map((table) => ({
      schema: "public",
      table,
      ownership: "verix_owned" as const,
      enabled: true,
      forced: false,
    })),
    policies: canonicalPolicies(tableNames),
    grants: canonicalGrants(tableNames),
    ambiguities: [],
    legacyObjects: [
      {
        id: "public.settings.compact_mode",
        ownership: "legacy_only",
        evidence: "Dropped by 0002_settings_expand.sql.",
        expectedPresent: false,
      },
      {
        id: "public.settings.push_notifications",
        ownership: "legacy_only",
        evidence: "Dropped by 0002_settings_expand.sql.",
        expectedPresent: false,
      },
      {
        id: "public.settings.booking_alerts",
        ownership: "legacy_only",
        evidence: "Dropped by 0002_settings_expand.sql.",
        expectedPresent: false,
      },
      {
        id: "public.settings.weekly_reports",
        ownership: "legacy_only",
        evidence: "Dropped by 0002_settings_expand.sql.",
        expectedPresent: false,
      },
      {
        id: "public.rental_unit_status",
        ownership: "legacy_only",
        evidence: "Created by 0011 and dropped by 0012.",
        expectedPresent: false,
      },
      {
        id: "public.rental_units.status",
        ownership: "legacy_only",
        evidence: "Created by 0011 and replaced by status_override in 0012.",
        expectedPresent: false,
      },
    ],
  });
}

export function buildSupabasePrerequisiteManifest(): SupabasePrerequisiteManifest {
  const roles: SupabasePrerequisite[] = (
    ["authenticated", "anon", "service_role"] as const
  ).map((identifier): SupabasePrerequisite => ({
    kind: "role",
    identifier,
    ownership: "supabase_managed",
    requiredAttributes:
      identifier === "service_role" ? { expectedRlsBehavior: "bypass" } : {},
    repositoryEvidence:
      identifier === "service_role"
        ? ["Supabase admin client is documented as an elevated RLS-bypass boundary."]
        : [`rls.sql and later migrations grant to ${identifier}.`],
    verixAction: "assert_only",
  }));
  const prerequisites: SupabasePrerequisite[] = [
    {
      kind: "schema",
      identifier: "auth",
      ownership: "supabase_managed",
      requiredAttributes: {},
      repositoryEvidence: ["src/server/db/rls.sql references auth.users and auth.uid()."],
      verixAction: "assert_only",
    },
    {
      kind: "relation",
      identifier: "auth.users",
      ownership: "supabase_managed",
      requiredAttributes: { requiredColumns: ["id", "email"] },
      repositoryEvidence: ["current_workspace_ids joins auth.users by id and email."],
      verixAction: "assert_only",
    },
    {
      kind: "function",
      identifier: "auth.uid()",
      ownership: "supabase_managed",
      requiredAttributes: { returnType: "uuid" },
      repositoryEvidence: ["current_workspace_ids compares auth.users.id to auth.uid()."],
      verixAction: "assert_only",
    },
    ...roles,
    {
      kind: "extension_capability",
      identifier: "btree_gist",
      ownership: "verix_required_extension",
      requiredAttributes: { available: true },
      repositoryEvidence: [
        "0011_reservations.sql executes CREATE EXTENSION IF NOT EXISTS btree_gist for reservations_no_overlap_excl.",
        "Fresh local Supabase exposes btree_gist 1.7 as available but not installed.",
      ],
      verixAction: "create_if_absent",
    },
    {
      kind: "function",
      identifier: "pg_catalog.gen_random_uuid()",
      ownership: "supabase_managed",
      requiredAttributes: { returnType: "uuid" },
      repositoryEvidence: ["0000 and current Drizzle schema use gen_random_uuid() defaults."],
      verixAction: "assert_only",
    },
  ];
  return {
    manifestVersion: 1,
    scope: "pre-sprint-1-supabase-prerequisites",
    prerequisites: prerequisites.sort((left, right) =>
      left.identifier.localeCompare(right.identifier, "en"),
    ),
  };
}
