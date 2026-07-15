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

/*
 * CRM pipeline RBAC (Sprint 10). Maps the brief's owner/manager/employee
 * matrix onto the existing `member_role` vocabulary:
 *  - Owner: full CRM admin (pipeline/stage CRUD including delete, everything
 *    below).
 *  - Manager: create/update/move opportunities, assign employees, manage
 *    activities, view all opportunities; create/rename/reorder stages, but
 *    cannot delete a pipeline or a protected (system-provisioned) stage —
 *    those stay owner-only via `assertOwnerRole`.
 *  - Employee: view/act only on opportunities assigned to them; cannot touch
 *    pipeline/stage configuration and cannot reassign an opportunity.
 */

/** Pipeline/stage configuration writes (except delete/protected-stage changes) and opportunity assignment require manager or owner. */
export function assertManagerOrOwnerRole(role: string): void {
  if (role !== "owner" && role !== "manager") {
    throw new AuthorizationError(
      "Only workspace owners and managers can perform this action.",
    );
  }
}

/**
 * An employee may only view or act on an opportunity assigned to them; owners
 * and managers may act on any opportunity in the workspace. Pure so the same
 * check backs both a single-record guard and a list/metrics scope decision
 * (see `resolveOpportunityScope` in `validators/crm-pipeline.ts`).
 */
export function assertCanAccessOpportunity(params: {
  role: string;
  actorUserId: string;
  assignedToUserId: string | null;
}): void {
  const { role, actorUserId, assignedToUserId } = params;
  if (role === "owner" || role === "manager") return;
  if (assignedToUserId !== actorUserId) {
    throw new AuthorizationError(
      "You can only view or act on opportunities assigned to you.",
    );
  }
}

/**
 * Renaming, recoloring, toggling won/lost, or deleting a *protected*
 * (system-provisioned) stage is owner-only; the same edits to a stage a
 * manager created themselves only require manager-or-owner. Pipeline
 * deletion itself is always owner-only (call `assertOwnerRole` directly).
 */
export function assertCanMutateStage(role: string, isProtected: boolean): void {
  if (isProtected) {
    assertOwnerRole(role);
  } else {
    assertManagerOrOwnerRole(role);
  }
}
