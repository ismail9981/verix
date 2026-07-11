/*
 * Role-based access-control primitives — pure and dependency-free (no db/env
 * imports) so they can be unit-tested and reused by both the impure
 * `authorize` helper and the team service. Each `assert*` throws
 * AuthorizationError on violation and returns void otherwise.
 */

/** Thrown when the caller lacks permission for an action. Actions map it to a 4xx-style result. */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Administrative actions require the workspace `owner` role. */
export function assertOwnerRole(role: string): void {
  if (role !== "owner") {
    throw new AuthorizationError(
      "Only workspace owners can perform this action.",
    );
  }
}

/**
 * An actor may not mutate their own membership through an admin action — this is
 * what prevents self-promotion (and self-lockout). Role/status changes to your
 * own membership must be made by another owner.
 */
export function assertNotSelf(actorUserId: string, targetUserId: string): void {
  if (actorUserId === targetUserId) {
    throw new AuthorizationError(
      "You can't change your own membership. Ask another owner.",
    );
  }
}

/**
 * Prevent the workspace from losing its last active owner. A change is blocked
 * when the target is currently an active owner, will no longer be one after the
 * change (demotion, deactivation, or removal), and is the only active owner.
 */
export function assertNotLastOwner(params: {
  targetIsActiveOwner: boolean;
  remainsActiveOwner: boolean;
  activeOwnerCount: number;
}): void {
  const { targetIsActiveOwner, remainsActiveOwner, activeOwnerCount } = params;
  if (targetIsActiveOwner && !remainsActiveOwner && activeOwnerCount <= 1) {
    throw new AuthorizationError(
      "You can't remove or demote the last owner of the workspace.",
    );
  }
}
