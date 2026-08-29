/*
 * Role-based access-control primitives — pure and dependency-free (no db/env
 * imports) so they can be unit-tested and reused by both the impure
 * `authorize` helper and the team service. Each `assert*` throws
 * AuthorizationError on violation and returns void otherwise.
 */

import {
  AuthorizationError,
  hasCapability,
  requireCapability,
} from "./capabilities";

export { AuthorizationError } from "./capabilities";

/** Administrative actions require the workspace `owner` role. */
export function assertOwnerRole(role: string): void {
  requireCapability({ role }, "crm.pipeline.delete");
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
  requireCapability({ role }, "crm.pipeline.manage");
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
  if (hasCapability({ role }, "crm.pipeline.manage")) return;
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

/*
 * Reservations RBAC (Sprint 11). Maps the brief's owner/manager/employee
 * matrix onto the existing `member_role` vocabulary:
 *  - Owner: full reservation + unit management, all metrics.
 *  - Manager: create/update/assign reservations, confirm/cancel/check-in/
 *    check-out, view all reservations. Cannot configure units (owner-only).
 *  - Employee: view only reservations assigned to them (via `staffId`) and
 *    apply a narrow set of operational status transitions
 *    (`isEmployeeAllowedTransition`) — cannot create, reassign, reprice, or
 *    view workspace-wide metrics.
 */

/**
 * An employee may only view or act on a reservation staffed to them; owners
 * and managers may act on any reservation in the workspace. Compares
 * `team_members.id` values (not `users.id`) since `reservations.staffId`
 * FKs to `team_members`.
 */
export function assertCanAccessReservation(params: {
  role: string;
  actorTeamMemberId: string;
  assignedStaffId: string | null;
}): void {
  const { role, actorTeamMemberId, assignedStaffId } = params;
  if (hasCapability({ role }, "reservations.assign")) return;
  if (assignedStaffId !== actorTeamMemberId) {
    throw new AuthorizationError(
      "You can only view or act on reservations assigned to you.",
    );
  }
}

/**
 * Validates a reservation status change: the transition itself must be legal
 * per the state machine (`isValidReservationStatusTransition`), and an
 * employee is further restricted to the narrower operational subset
 * (`isEmployeeAllowedTransition`) — confirming, cancelling, or any other
 * transition stays owner/manager-only.
 */
export function assertStatusTransitionAllowed(
  role: string,
  isValidTransition: boolean,
  isEmployeeAllowed: boolean,
): void {
  if (!isValidTransition) {
    throw new AuthorizationError("That status change isn't allowed.");
  }
  if (hasCapability({ role }, "reservations.assign")) return;
  if (!isEmployeeAllowed) {
    throw new AuthorizationError(
      "You don't have permission to make that status change.",
    );
  }
}

/*
 * Housekeeping RBAC (Sprint 13). Maps the brief's owner/manager/employee
 * matrix onto the existing `member_role` vocabulary:
 *  - Owner: full access — create/edit/assign/start/complete/cancel any task.
 *  - Manager: create/edit/assign/start/complete/cancel any task; view all
 *    tasks; cannot permanently delete historical task records (there is no
 *    hard-delete action at all — only soft-delete/cancel, so this is
 *    structural rather than an explicit check).
 *  - Employee: view/start/complete only tasks assigned to them; may add
 *    completion notes; cannot create, assign/reassign, cancel, or edit any
 *    other field (unit, reservation, type, priority, scope).
 */

/**
 * An employee may only view or act on a housekeeping task assigned to them;
 * owners and managers may act on any task in the workspace. Compares
 * `team_members.id` values (not `users.id`) since `housekeepingTasks.assignedTo`
 * FKs to `team_members` — mirrors `assertCanAccessReservation`.
 */
export function assertCanAccessHousekeepingTask(params: {
  role: string;
  actorTeamMemberId: string;
  assignedTeamMemberId: string | null;
}): void {
  const { role, actorTeamMemberId, assignedTeamMemberId } = params;
  if (hasCapability({ role }, "housekeeping.assign")) return;
  if (assignedTeamMemberId !== actorTeamMemberId) {
    throw new AuthorizationError(
      "You can only view or act on housekeeping tasks assigned to you.",
    );
  }
}

/**
 * Validates a housekeeping task status change: the transition itself must be
 * legal per the state machine (`isValidHousekeepingStatusTransition`), and an
 * employee is further restricted to the narrower start/complete-own-task
 * subset (`isEmployeeAllowedHousekeepingTransition`) — assigning, cancelling,
 * or any other transition stays owner/manager-only.
 */
export function assertHousekeepingTransitionAllowed(
  role: string,
  isValidTransition: boolean,
  isEmployeeAllowed: boolean,
): void {
  if (!isValidTransition) {
    throw new AuthorizationError("That status change isn't allowed.");
  }
  if (hasCapability({ role }, "housekeeping.assign")) return;
  if (!isEmployeeAllowed) {
    throw new AuthorizationError(
      "You don't have permission to make that status change.",
    );
  }
}

/*
 * Billing RBAC (Sprint 14). Maps the brief's owner/manager/employee matrix
 * onto the existing `member_role` vocabulary:
 *  - Owner: full access — line items, issuing, voiding, writing off, and
 *    both recording and refunding payments.
 *  - Manager: identical to owner for billing.
 *  - Employee: no invoice, payment, refund, or financial-data access under
 *    the approved Sprint 1 permission matrix.
 */

/** Invoice access is financial: the central matrix denies every employee. */
export function assertCanAccessInvoice(params: {
  role: string;
  actorTeamMemberId: string;
  assignedStaffId: string | null;
}): void {
  requireCapability({ role: params.role }, "invoices.read");
}

/** Every billing action an actor might request against an invoice/payment. */
export type InvoiceAction =
  | "editLineItems"
  | "issue"
  | "recordPayment"
  | "refund"
  | "voidPayment"
  | "void"
  | "writeOff";

/**
 * Gates *which* billing action a role may perform — distinct from, and
 * called alongside, `assertCanAccessInvoice` (which gates *which invoice*).
 * Every billing action maps to the canonical invoice/payment/refund
 * capability; no Workspace role receives an implicit exception.
 */
export function assertInvoiceActionAllowed(
  role: string,
  action: InvoiceAction,
): void {
  const capability =
    action === "recordPayment" || action === "voidPayment"
      ? "payments.manage"
      : action === "refund"
        ? "refunds.manage"
        : "invoices.manage";
  requireCapability({ role }, capability);
}
