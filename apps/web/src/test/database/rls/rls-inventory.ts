import type { CatalogManifest } from "../catalog/catalog-manifest";

export type RlsScopeClassification =
  | "workspace_scoped"
  | "auth_dependent"
  | "operational_internal"
  | "uncertain";

export interface RlsCoverageInventoryEntry {
  readonly table: string;
  readonly rlsEnabled: boolean;
  readonly forceRls: boolean;
  readonly policy: string;
  readonly command: string;
  readonly roles: readonly string[];
  readonly usingExpression: string | null;
  readonly withCheckExpression: string | null;
  readonly helperPattern:
    | "workspace_id"
    | "workspace_primary_key"
    | "comember_user_id"
    | "conversation_parent";
  readonly classification: RlsScopeClassification;
  readonly roleAware: boolean;
  readonly serviceRoleBypassesRls: boolean;
}

const SPECIAL_PATTERNS = new Map<
  string,
  RlsCoverageInventoryEntry["helperPattern"]
>([
  ["workspaces", "workspace_primary_key"],
  ["users", "comember_user_id"],
  ["ai_messages", "conversation_parent"],
]);

const OPERATIONAL_TABLES = new Set([
  "ai_conversations",
  "ai_messages",
  "files",
  "integrations",
  "notifications",
  "settings",
]);

/** Builds a deterministic inventory directly from the canonical catalog. */
export function buildRlsCoverageInventory(
  manifest: CatalogManifest,
): readonly RlsCoverageInventoryEntry[] {
  const policyByTable = new Map(
    manifest.policies.map((policy) => [policy.table, policy]),
  );

  return manifest.rls
    .map((rls) => {
      const policy = policyByTable.get(rls.table);
      if (!policy) {
        throw new Error(`Canonical RLS table ${rls.table} has no policy.`);
      }

      const classification: RlsScopeClassification =
        rls.table === "users" || rls.table === "team_members"
          ? "auth_dependent"
          : OPERATIONAL_TABLES.has(rls.table)
            ? "operational_internal"
            : "workspace_scoped";

      return {
        table: rls.table,
        rlsEnabled: rls.enabled,
        forceRls: rls.forced,
        policy: policy.name,
        command: policy.command,
        roles: policy.roles,
        usingExpression: policy.using,
        withCheckExpression: policy.withCheck,
        helperPattern: SPECIAL_PATTERNS.get(rls.table) ?? "workspace_id",
        classification,
        roleAware: false,
        serviceRoleBypassesRls: true,
      } satisfies RlsCoverageInventoryEntry;
    })
    .sort((left, right) => left.table.localeCompare(right.table));
}

export function summarizeRlsCoverage(
  inventory: readonly RlsCoverageInventoryEntry[],
) {
  return {
    tables: inventory.length,
    rlsEnabled: inventory.filter((entry) => entry.rlsEnabled).length,
    forceRlsEnabled: inventory.filter((entry) => entry.forceRls).length,
    membershipOnlyPolicies: inventory.filter((entry) => !entry.roleAware).length,
    helperPatterns: [...new Set(inventory.map((entry) => entry.helperPattern))].sort(),
    uncoveredCrudCommands: inventory.filter((entry) => entry.command !== "all")
      .length,
  };
}
