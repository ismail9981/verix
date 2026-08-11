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
      result += character.toLowerCase();
    }
  }

  return result
    .trim()
    .replace(/\s+([(),;])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/"([a-z_][a-z0-9_]*)"/g, "$1");
}

function hasSingleOuterParentheses(source: string): boolean {
  if (!source.startsWith("(") || !source.endsWith(")")) return false;
  let depth = 0;
  let quote: "single" | "double" | null = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    const next = source[index + 1] ?? "";
    if (quote === "single") {
      if (character === "'" && next === "'") index += 1;
      else if (character === "'") quote = null;
      continue;
    }
    if (quote === "double") {
      if (character === '"' && next === '"') index += 1;
      else if (character === '"') quote = null;
      continue;
    }
    if (character === "'") quote = "single";
    else if (character === '"') quote = "double";
    else if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    if (depth === 0 && index < source.length - 1) return false;
  }
  return depth === 0;
}

function splitTopLevelKeyword(source: string, keyword: "and" | "or"): string[] {
  const parts: string[] = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote: "single" | "double" | null = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    const next = source[index + 1] ?? "";
    if (quote === "single") {
      if (character === "'" && next === "'") index += 1;
      else if (character === "'") quote = null;
      continue;
    }
    if (quote === "double") {
      if (character === '"' && next === '"') index += 1;
      else if (character === '"') quote = null;
      continue;
    }
    if (character === "'") quote = "single";
    else if (character === '"') quote = "double";
    else if (character === "(") parentheses += 1;
    else if (character === ")") parentheses -= 1;
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    if (parentheses !== 0 || brackets !== 0) continue;
    if (
      source.slice(index, index + keyword.length) === keyword &&
      !/[a-z0-9_]/.test(source[index - 1] ?? "") &&
      !/[a-z0-9_]/.test(source[index + keyword.length] ?? "")
    ) {
      parts.push(source.slice(start, index).trim());
      start = index + keyword.length;
      index += keyword.length - 1;
    }
  }
  if (parts.length === 0) return [source];
  parts.push(source.slice(start).trim());
  return parts;
}

function expressionPrecedence(source: string): number {
  if (splitTopLevelKeyword(source, "or").length > 1) return 1;
  if (splitTopLevelKeyword(source, "and").length > 1) return 2;
  if (/^not(?:\s|\()/.test(source)) return 3;
  return 4;
}

function normalizeAtom(source: string): string {
  return source
    .replace(/\s*(<>|>=|<=|=|>|<|~)\s*/g, " $1 ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function normalizeBooleanExpression(
  source: string,
  parentPrecedence = 0,
): string {
  let value = source.trim();
  while (hasSingleOuterParentheses(value)) value = value.slice(1, -1).trim();

  const orParts = splitTopLevelKeyword(value, "or");
  if (orParts.length > 1) {
    const result = orParts
      .map((part) => normalizeBooleanExpression(part, 1))
      .join(" or ");
    return parentPrecedence > 1 ? `(${result})` : result;
  }
  const andParts = splitTopLevelKeyword(value, "and");
  if (andParts.length > 1) {
    const result = andParts
      .map((part) => normalizeBooleanExpression(part, 2))
      .join(" and ");
    return parentPrecedence > 2 ? `(${result})` : result;
  }
  if (/^not(?:\s|\()/.test(value)) {
    const operand = value.slice(3).trim();
    const normalizedOperand = normalizeBooleanExpression(operand, 3);
    const wrapped =
      expressionPrecedence(operand) < 3 &&
      !hasSingleOuterParentheses(normalizedOperand)
        ? `(${normalizedOperand})`
        : normalizedOperand;
    return `not ${wrapped}`;
  }
  return normalizeAtom(value);
}

/** Normalizes catalog-deparsed expressions without erasing operator structure. */
export function normalizeCatalogExpression(
  source: string | null,
  table?: string,
): string | null {
  let result = normalizeSql(source);
  if (result === null) return null;
  if (table) result = result.replaceAll(`${table}.`, "");
  result = result
    .replace(/\b(?:old|new)\./g, "")
    .replace(
      /\bpublic\.(current_(?:workspace|comember|conversation)_ids)\b/g,
      "$1",
    )
    .replace(
      /\s+as\s+(current_(?:workspace|comember|conversation)_ids)(?=\))/g,
      "",
    )
    .replace(/('(?:''|[^'])*')::[a-z_][a-z0-9_]*(?:\[\])?/g, "$1")
    .replace(
      /\b([a-z_][a-z0-9_]*)\s*<>\s*all\(array\[([^\]]+)\]\)/g,
      "$1 not in($2)",
    );

  const exclusion = /^(exclude using gist\(.*\)) where\((.*)\)$/.exec(result);
  if (exclusion) {
    return `${normalizeAtom(exclusion[1] ?? "")} where(${normalizeBooleanExpression(exclusion[2] ?? "")})`;
  }
  return normalizeBooleanExpression(result);
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
    using: normalizeCatalogExpression(policy.using, policy.table),
    withCheck: normalizeCatalogExpression(policy.withCheck, policy.table),
  };
}

/** Selects only stable, Verix-owned catalog fields and sorts every collection. */
export function normalizeCatalogManifest(
  manifest: CatalogManifest,
): CatalogManifest {
  return {
    manifestVersion: 1,
    scope: manifest.scope,
    tables: [...manifest.tables]
      .map((table) => ({
        schema: table.schema,
        name: table.name,
        ownership: table.ownership,
        columns: table.columns
          .map((column) => ({
            name: column.name,
            type: column.type,
            nullable: column.nullable,
            default: normalizeSql(column.default),
            identity: column.identity,
            generated: column.generated,
          }))
          .sort((a, b) => compareText(a.name, b.name)),
      }))
      .sort((a, b) =>
        compareText(`${a.schema}.${a.name}`, `${b.schema}.${b.name}`),
      ),
    enums: [...manifest.enums]
      .map((value) => ({
        schema: value.schema,
        name: value.name,
        ownership: value.ownership,
        values: [...value.values],
      }))
      .sort((a, b) =>
        compareText(`${a.schema}.${a.name}`, `${b.schema}.${b.name}`),
      ),
    indexes: [...manifest.indexes]
      .map((index) => ({
        schema: index.schema,
        table: index.table,
        name: index.name,
        ownership: index.ownership,
        unique: index.unique,
        method: index.method,
        keys: [...index.keys].map(
          (key) => normalizeCatalogExpression(key, index.table) ?? "",
        ),
        predicate: normalizeCatalogExpression(index.predicate, index.table),
      }))
      .sort((a, b) =>
        compareText(
          `${a.schema}.${a.table}.${a.name}`,
          `${b.schema}.${b.table}.${b.name}`,
        ),
      ),
    constraints: [...manifest.constraints]
      .map((constraint) => ({
        schema: constraint.schema,
        table: constraint.table,
        name:
          constraint.type === "foreign_key"
            ? `fk:${constraint.columns.join(",")}`
            : constraint.name,
        ownership: constraint.ownership,
        type: constraint.type,
        columns: constraint.type === "check" ? [] : [...constraint.columns],
        referencedSchema: constraint.referencedSchema,
        referencedTable: constraint.referencedTable,
        referencedColumns: [...constraint.referencedColumns],
        onUpdate: constraint.onUpdate,
        onDelete: constraint.onDelete,
        definition: normalizeCatalogExpression(
          constraint.definition,
          constraint.table,
        ),
        deferrable: constraint.deferrable,
        initiallyDeferred: constraint.initiallyDeferred,
        validated: constraint.validated,
      }))
      .sort((a, b) =>
        compareText(
          `${a.schema}.${a.table}.${a.name}`,
          `${b.schema}.${b.table}.${b.name}`,
        ),
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
        ownerTrust: fn.ownerTrust,
        configuration: [...fn.configuration].sort(compareText),
        body: normalizeSql(fn.body) ?? "",
      }))
      .sort((a, b) =>
        compareText(
          `${a.schema}.${a.name}(${a.arguments})`,
          `${b.schema}.${b.name}(${b.arguments})`,
        ),
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
        condition: normalizeCatalogExpression(trigger.condition, trigger.table),
      }))
      .sort((a, b) =>
        compareText(
          `${a.schema}.${a.table}.${a.name}`,
          `${b.schema}.${b.table}.${b.name}`,
        ),
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
        compareText(
          `${a.schema}.${a.table}.${a.name}`,
          `${b.schema}.${b.table}.${b.name}`,
        ),
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
    scope: normalized.scope,
    value: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  };
}
