import { getAuthorizedWorkspace, type AuthorizedWorkspace } from "./workspace";
import { assertManagerOrOwnerRole, assertOwnerRole } from "./rbac";

/*
 * Authorization helpers for Server Actions. Both derive the workspace from
 * the session (never the client) and enforce a role floor. Throw
 * AuthorizationError (from ./rbac) when the caller doesn't meet it.
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
