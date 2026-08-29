import { getAuthorizedWorkspace, type AuthorizedWorkspace } from "./workspace";
import { assertManagerOrOwnerRole, assertOwnerRole } from "./rbac";
import { requireCapability, type Capability } from "./capabilities";

/*
 * Authorization helpers for Server Actions. Every helper derives the
 * workspace from the session (never the client). New entry points use the
 * capability helper; the role-floor wrappers remain for legacy compatibility.
 */

export async function requireOwner(): Promise<AuthorizedWorkspace> {
  const workspace = await getAuthorizedWorkspace();
  assertOwnerRole(workspace.role);
  return workspace;
}

/** CRM pipeline/stage configuration and opportunity assignment (Sprint 10). */
export async function requireManagerOrAbove(): Promise<AuthorizedWorkspace> {
  const workspace = await getAuthorizedWorkspace();
  assertManagerOrOwnerRole(workspace.role);
  return workspace;
}

/** Canonical Server Action/page boundary for Workspace capabilities. */
export async function requireActiveWorkspaceCapability(
  capability: Capability,
): Promise<AuthorizedWorkspace> {
  const workspace = await getAuthorizedWorkspace();
  requireCapability(workspace, capability);
  return workspace;
}
