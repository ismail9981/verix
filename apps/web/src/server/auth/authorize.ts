import { getAuthorizedWorkspace, type AuthorizedWorkspace } from "./workspace";
import { assertOwnerRole } from "./rbac";

/*
 * Authorization helper for administrative Server Actions. Derives the workspace
 * from the session (never the client) and enforces the owner role. Throws
 * AuthorizationError (from ./rbac) when the caller is not an owner.
 */

export async function requireOwner(): Promise<AuthorizedWorkspace> {
  const workspace = await getAuthorizedWorkspace();
  assertOwnerRole(workspace.role);
  return workspace;
}
