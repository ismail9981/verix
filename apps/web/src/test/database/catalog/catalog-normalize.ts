import { createHash } from "node:crypto";
import type {
  CatalogFingerprint,
  CatalogManifest,
  CatalogPolicy,
} from "./catalog-manifest";

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

/**
 * Collapses insignificant SQL whitespace while preserving quoted contents.
 * It intentionally does not lowercase SQL because quoted identifiers and
 * string literals are case-sensitive catalog evidence.
 */
export function normalizeSql(source: string | null): string | null {
  if (source === null) return null;

  let result = "";
  let pendingSpace = false;
  let quote: "single" | "double" | null = null;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (quote === "single") {
      result += character;
      if (character === "'" && next === "'") {
        result += next;
        index += 1;
      } else if (character === "'") {
        quote = null;
      }
      continue;
    }

    if (quote === "double") {
      result += character;
      if (character === '"' && next === '"') {
        result += next;
        index += 1;
      } else if (character === '"') {
        quote = null;
      }
      continue;
    }

    if (character === "'") {
      if (pendingSpace && result) result += " ";
      pendingSpace = false;
      quote = "single";
      result += character;
    } else if (character === '"') {
      if (pendingSpace && result) result += " ";
      pendingSpace = false;
      quote = "double";
      result += character;
    } else if (/\s/.test(character)) {
      pendingSpace = true;
    } else {
      if (pendingSpace && result && !"(),;".includes(character)) result += " ";
      pendingSpace = false;
      result += character;
    }
  }

  return result.trim().replace(/\s+([(),;])/g, "$1");
}

function normalizePolicy(policy: CatalogPolicy): CatalogPolicy {
  return {
    schema: policy.schema,
    table: policy.table,
    name: policy.name,
    ownership: policy.ownership,
    permissive: policy.permissive,
    command: policy.command,
    roles: [...policy.roles].sort(compareText),
    using: normalizeSql(policy.using),
    withCheck: normalizeSql(policy.withCheck),
  };
}

/** Selects only stable, Verix-owned catalog fields and sorts every collection. */
export function normalizeCatalogManifest(
  manifest: CatalogManifest,
): CatalogManifest {
  return {
    manifestVersion: 1,
    scope: "pre-sprint-1",
    tables: [...manifest.tables]
      .map((table) => ({
        schema: table.schema,
        name: table.name,
        ownership: table.ownership,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type,
          nullable: column.nullable,
          default: normalizeSql(column.default),
          identity: column.identity,
          generated: column.generated,
        })),
      }))
      .sort((a, b) => compareText(`${a.schema}.${a.name}`, `${b.schema}.${b.name}`)),
    enums: [...manifest.enums]
      .map((value) => ({
        schema: value.schema,
        name: value.name,
        ownership: value.ownership,
        values: [...value.values],
      }))
      .sort((a, b) => compareText(`${a.schema}.${a.name}`, `${b.schema}.${b.name}`)),
    indexes: [...manifest.indexes]
      .map((index) => ({
        schema: index.schema,
        table: index.table,
        name: index.name,
        ownership: index.ownership,
        unique: index.unique,
        method: index.method,
        keys: [...index.keys].map((key) => normalizeSql(key) ?? ""),
        predicate: normalizeSql(index.predicate),
      }))
      .sort((a, b) =>
        compareText(`${a.schema}.${a.table}.${a.name}`, `${b.schema}.${b.table}.${b.name}`),
      ),
    constraints: [...manifest.constraints]
      .map((constraint) => ({
        schema: constraint.schema,
        table: constraint.table,
        name: constraint.name,
        ownership: constraint.ownership,
        type: constraint.type,
        columns: [...constraint.columns],
        referencedSchema: constraint.referencedSchema,
        referencedTable: constraint.referencedTable,
        referencedColumns: [...constraint.referencedColumns],
        onUpdate: constraint.onUpdate,
        onDelete: constraint.onDelete,
        definition: normalizeSql(constraint.definition),
        deferrable: constraint.deferrable,
        initiallyDeferred: constraint.initiallyDeferred,
        validated: constraint.validated,
      }))
      .sort((a, b) =>
        compareText(`${a.schema}.${a.table}.${a.name}`, `${b.schema}.${b.table}.${b.name}`),
      ),
    functions: [...manifest.functions]
      .map((fn) => ({
        schema: fn.schema,
        name: fn.name,
        ownership: fn.ownership,
        arguments: normalizeSql(fn.arguments) ?? "",
        returnType: normalizeSql(fn.returnType) ?? "",
        language: fn.language,
        volatility: fn.volatility,
        securityDefiner: fn.securityDefiner,
        configuration: [...fn.configuration].sort(compareText),
        body: normalizeSql(fn.body) ?? "",
      }))
      .sort((a, b) =>
        compareText(`${a.schema}.${a.name}(${a.arguments})`, `${b.schema}.${b.name}(${b.arguments})`),
      ),
    triggers: [...manifest.triggers]
      .map((trigger) => ({
        schema: trigger.schema,
        table: trigger.table,
        name: trigger.name,
        ownership: trigger.ownership,
        timing: trigger.timing,
        events: [...trigger.events].sort(compareText),
        orientation: trigger.orientation,
        functionSchema: trigger.functionSchema,
        functionName: trigger.functionName,
        condition: normalizeSql(trigger.condition),
      }))
      .sort((a, b) =>
        compareText(`${a.schema}.${a.table}.${a.name}`, `${b.schema}.${b.table}.${b.name}`),
      ),
    rls: manifest.rls
      .map((state) => ({
        schema: state.schema,
        table: state.table,
        ownership: state.ownership,
        enabled: state.enabled,
        forced: state.forced,
      }))
      .sort((a, b) =>
        compareText(`${a.schema}.${a.table}`, `${b.schema}.${b.table}`),
      ),
    policies: [...manifest.policies]
      .map(normalizePolicy)
      .sort((a, b) =>
        compareText(`${a.schema}.${a.table}.${a.name}`, `${b.schema}.${b.table}.${b.name}`),
      ),
    grants: manifest.grants
      .map((grant) => ({
        targetKind: grant.targetKind,
        schema: grant.schema,
        object: grant.object,
        ownership: grant.ownership,
        grantee: grant.grantee,
        privilege: grant.privilege,
      }))
      .sort((a, b) =>
        compareText(
          `${a.targetKind}.${a.schema}.${a.object}.${a.grantee}.${a.privilege}`,
          `${b.targetKind}.${b.schema}.${b.object}.${b.grantee}.${b.privilege}`,
        ),
      ),
    ambiguities: [...manifest.ambiguities]
      .map((ambiguity) => ({
        id: ambiguity.id,
        ownership: ambiguity.ownership,
        evidence: [...ambiguity.evidence].sort(compareText),
        adoptionImpact: ambiguity.adoptionImpact,
      }))
      .sort((a, b) => compareText(a.id, b.id)),
    legacyObjects: manifest.legacyObjects
      .map((legacy) => ({
        id: legacy.id,
        ownership: legacy.ownership,
        evidence: legacy.evidence,
        expectedPresent: legacy.expectedPresent,
      }))
      .sort((a, b) => compareText(a.id, b.id)),
  };
}

/**
 * Ambiguities and legacy evidence affect adoption status but not the catalog
 * hash. Supabase prerequisites live in a separate manifest and are excluded.
 */
export function fingerprintCatalogManifest(
  manifest: CatalogManifest,
): CatalogFingerprint {
  const normalized = normalizeCatalogManifest(manifest);
  const payload = {
    manifestVersion: normalized.manifestVersion,
    scope: normalized.scope,
    tables: normalized.tables,
    enums: normalized.enums,
    indexes: normalized.indexes,
    constraints: normalized.constraints,
    functions: normalized.functions,
    triggers: normalized.triggers,
    rls: normalized.rls,
    policies: normalized.policies,
    grants: normalized.grants,
  };

  return {
    algorithm: "sha256",
    manifestVersion: 1,
    scope: "pre-sprint-1",
    value: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  };
}
