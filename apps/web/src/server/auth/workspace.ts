import {
  getActiveWorkspaceContext,
  resolveActiveWorkspaceInTransaction,
  type WorkspaceContext,
} from "./active-workspace";
import type { AuthIdentity, IdentityTransaction } from "./identity";

/**
 * Compatibility surface for existing workspace-scoped pages/actions. The
 * implementation is the explicit Active Workspace boundary; no service or
 * action independently chooses a membership.
 */
export interface AuthorizedWorkspace {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: string;
  readonly membershipId: string;
  readonly authUserId: string;
  readonly selectionSource: WorkspaceContext["selectionSource"];
}

function authorized(context: WorkspaceContext): AuthorizedWorkspace {
  return {
    workspaceId: context.workspaceId,
    userId: context.internalUserId,
    role: context.role,
    membershipId: context.membershipId,
    authUserId: context.authUserId,
    selectionSource: context.selectionSource,
  };
}

export async function getAuthorizedWorkspace(): Promise<AuthorizedWorkspace> {
  return authorized(await getActiveWorkspaceContext());
}

/** Transactional compatibility helper retained for B4/B5 integration tests. */
export async function resolveAuthorizedWorkspaceInTransaction(
  tx: IdentityTransaction,
  authUser: AuthIdentity,
): Promise<AuthorizedWorkspace & { readonly isNewWorkspace: boolean; readonly identity: { userId: string; kind: string } }> {
  const result = await resolveActiveWorkspaceInTransaction(tx, authUser, null);
  if (result.state !== "AUTO_SELECTED" && result.state !== "SELECTED") {
    throw new Error(`ACTIVE_WORKSPACE_${result.state}`);
  }
  return {
    ...authorized(result.context),
    isNewWorkspace: result.isNewWorkspace,
    identity: {
      userId: result.context.internalUserId,
      kind: result.identityKind,
    },
  };
}
