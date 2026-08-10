export type CatalogOwnership =
  | "supabase_managed"
  | "verix_owned"
  | "legacy_only"
  | "uncertain";

export interface CatalogColumn {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly default: string | null;
  readonly identity: "always" | "by_default" | null;
  readonly generated: "stored" | null;
}

export interface CatalogTable {
  readonly schema: string;
  readonly name: string;
  readonly ownership: "verix_owned";
  readonly columns: readonly CatalogColumn[];
}

export interface CatalogEnum {
  readonly schema: string;
  readonly name: string;
  readonly ownership: "verix_owned";
  readonly values: readonly string[];
}

export type ConstraintType =
  | "primary_key"
  | "unique"
  | "foreign_key"
  | "check"
  | "exclusion";

export interface CatalogConstraint {
  readonly schema: string;
  readonly table: string;
  readonly name: string;
  readonly ownership: "verix_owned";
  readonly type: ConstraintType;
  readonly columns: readonly string[];
  readonly referencedSchema: string | null;
  readonly referencedTable: string | null;
  readonly referencedColumns: readonly string[];
  readonly onUpdate: string | null;
  readonly onDelete: string | null;
  readonly definition: string | null;
  readonly deferrable: boolean;
  readonly initiallyDeferred: boolean;
  readonly validated: boolean;
}

export interface CatalogIndex {
  readonly schema: string;
  readonly table: string;
  readonly name: string;
  readonly ownership: "verix_owned";
  readonly unique: boolean;
  readonly method: string;
  readonly keys: readonly string[];
  readonly predicate: string | null;
}

export interface CatalogFunction {
  readonly schema: string;
  readonly name: string;
  readonly ownership: "verix_owned";
  readonly arguments: string;
  readonly returnType: string;
  readonly language: string;
  readonly volatility: "immutable" | "stable" | "volatile";
  readonly securityDefiner: boolean;
  readonly configuration: readonly string[];
  readonly body: string;
}

export interface CatalogTrigger {
  readonly schema: string;
  readonly table: string;
  readonly name: string;
  readonly ownership: "verix_owned";
  readonly timing: "before" | "after" | "instead_of";
  readonly events: readonly string[];
  readonly orientation: "row" | "statement";
  readonly functionSchema: string;
  readonly functionName: string;
  readonly condition: string | null;
}

export interface CatalogRlsState {
  readonly schema: string;
  readonly table: string;
  readonly ownership: "verix_owned";
  readonly enabled: boolean;
  readonly forced: boolean;
}

export interface CatalogPolicy {
  readonly schema: string;
  readonly table: string;
  readonly name: string;
  readonly ownership: "verix_owned";
  readonly permissive: boolean;
  readonly command: "all" | "select" | "insert" | "update" | "delete";
  readonly roles: readonly string[];
  readonly using: string | null;
  readonly withCheck: string | null;
}

export interface CatalogGrant {
  readonly targetKind: "table" | "function";
  readonly schema: string;
  readonly object: string;
  readonly ownership: "verix_owned";
  readonly grantee: "anon" | "authenticated" | "service_role";
  readonly privilege: string;
}

export interface CatalogAmbiguity {
  readonly id: string;
  readonly ownership: "uncertain";
  readonly evidence: readonly string[];
  readonly adoptionImpact: string;
}

export interface LegacyCatalogObject {
  readonly id: string;
  readonly ownership: "legacy_only";
  readonly evidence: string;
  readonly expectedPresent: false;
}

export interface CatalogManifest {
  readonly manifestVersion: 1;
  readonly scope: "pre-sprint-1";
  readonly tables: readonly CatalogTable[];
  readonly enums: readonly CatalogEnum[];
  readonly indexes: readonly CatalogIndex[];
  readonly constraints: readonly CatalogConstraint[];
  readonly functions: readonly CatalogFunction[];
  readonly triggers: readonly CatalogTrigger[];
  readonly rls: readonly CatalogRlsState[];
  readonly policies: readonly CatalogPolicy[];
  readonly grants: readonly CatalogGrant[];
  readonly ambiguities: readonly CatalogAmbiguity[];
  readonly legacyObjects: readonly LegacyCatalogObject[];
}

export type SupabasePrerequisiteKind =
  | "schema"
  | "relation"
  | "function"
  | "role"
  | "extension_capability";

export interface SupabasePrerequisite {
  readonly kind: SupabasePrerequisiteKind;
  readonly identifier: string;
  readonly ownership: "supabase_managed";
  readonly requiredAttributes: Readonly<Record<string, boolean | string | readonly string[]>>;
  readonly repositoryEvidence: readonly string[];
  readonly verixAction: "assert_only";
}

export interface SupabasePrerequisiteManifest {
  readonly manifestVersion: 1;
  readonly scope: "pre-sprint-1-supabase-prerequisites";
  readonly prerequisites: readonly SupabasePrerequisite[];
}

export interface CatalogFingerprint {
  readonly algorithm: "sha256";
  readonly manifestVersion: 1;
  readonly scope: "pre-sprint-1";
  readonly value: string;
}
