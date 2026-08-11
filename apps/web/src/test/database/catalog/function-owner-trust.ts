import type { CatalogFunction } from "./catalog-manifest";

export interface FunctionOwnerEvidence {
  readonly securityDefiner: boolean;
  readonly roleName: string;
  readonly canLogin: boolean;
  readonly superuser: boolean;
  readonly bypassRls: boolean;
}

const SUPABASE_TRUSTED_ADMIN_ROLES = new Set(["postgres", "supabase_admin"]);
const APPLICATION_ROLES = new Set(["anon", "authenticated", "service_role"]);

/**
 * Owner names are evaluated against the local Supabase trust policy but only
 * the portable classification enters the deterministic catalog fingerprint.
 */
export function classifyFunctionOwnerTrust(
  evidence: FunctionOwnerEvidence,
): CatalogFunction["ownerTrust"] {
  if (!evidence.securityDefiner) return "not_applicable";
  if (APPLICATION_ROLES.has(evidence.roleName)) {
    return "untrusted_application_owner";
  }
  if (
    SUPABASE_TRUSTED_ADMIN_ROLES.has(evidence.roleName) &&
    (evidence.superuser || evidence.bypassRls)
  ) {
    return "trusted_privileged_owner";
  }
  if (!evidence.superuser && !evidence.bypassRls && evidence.canLogin) {
    return "untrusted_application_owner";
  }
  return "unknown_owner";
}
