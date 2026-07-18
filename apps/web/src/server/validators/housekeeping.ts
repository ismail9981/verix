import { z } from "zod";
import { cleanOptional } from "./shared";
import type { UnitConditionOverride } from "./rental-unit";

/*
 * Validation + pure decision logic for Housekeeping & Unit Operations
 * (Sprint 13): cleaning/maintenance/inspection tasks tied to a rental unit,
 * optionally linked to the reservation that triggered them. Dependency-free
 * (no db/env imports) so every invariant here is unit-testable — mirrors the
 * split `reservation.ts` established between pure decisions and
 * `housekeeping.service.ts`'s DB access.
 */

export const HOUSEKEEPING_TASK_TYPES = [
  "cleaning",
  "inspection",
  "maintenance",
  "linen_change",
  "restocking",
  "other",
] as const;
export type HousekeepingTaskType = (typeof HOUSEKEEPING_TASK_TYPES)[number];

export const HOUSEKEEPING_TASK_STATUSES = [
  "pending",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type HousekeepingTaskStatus =
  (typeof HOUSEKEEPING_TASK_STATUSES)[number];

export const HOUSEKEEPING_TASK_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;
export type HousekeepingTaskPriority =
  (typeof HOUSEKEEPING_TASK_PRIORITIES)[number];

/**
 * A single "tab" filter combining status/type/priority/assignment shortcuts
 * the spec asks for, plus `"all"`. Resolved into the actual WHERE clause by
 * `housekeeping.service.ts`'s `listHousekeepingTasks` — kept as one flat enum
 * here (rather than several independent booleans) since the UI renders it as
 * a single row of mutually-exclusive tabs.
 */
export const HOUSEKEEPING_QUICK_FILTERS = [
  "all",
  "pending",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
  "cleaning",
  "maintenance",
  "urgent",
  "unassigned",
  "assigned_to_me",
] as const;
export type HousekeepingQuickFilter =
  (typeof HOUSEKEEPING_QUICK_FILTERS)[number];

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/** Lean DTO (with joined unit/property/building/reservation/assignee names) sent to the client. */
export interface HousekeepingTaskListItem {
  id: string;
  propertyId: string;
  propertyName: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitName: string;
  reservationId: string | null;
  taskType: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  priority: HousekeepingTaskPriority;
  assignedTo: string | null;
  assignedToName: string | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  completedBy: string | null;
  completedByName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Authoritative, server-computed as of the workspace's own local calendar date (see `isTaskOverdue`) — never derived from the viewer's browser-local clock, which can disagree with the server near a timezone/midnight boundary. */
  isOverdue: boolean;
}

export interface HousekeepingTaskMetrics {
  pending: number;
  assigned: number;
  inProgress: number;
  completedToday: number;
  overdue: number;
  urgent: number;
  unassigned: number;
}

export interface HousekeepingUnitSummary {
  unitsUnderCleaning: number;
  unitsUnderMaintenance: number;
}

/** A unit eligible to have a new housekeeping task created for it — carries its property/building names so the create form can disambiguate similarly-named units across a workspace's portfolio. */
export interface HousekeepingUnitOption {
  id: string;
  name: string;
  propertyName: string;
  buildingName: string;
}

/** `propertyId`/`buildingId` in this shape always come from the unit's own row — never from client input — matching what `resolveEligibleUnitParents` validates and re-derives. */
export interface UnitParentCandidate {
  id: string;
  workspaceId: string;
  deletedAt: Date | null;
  propertyId: string;
  propertyArchivedAt: Date | null;
  propertyDeletedAt: Date | null;
  buildingId: string;
  buildingArchivedAt: Date | null;
  buildingDeletedAt: Date | null;
}

/**
 * THE single source of truth for whether a unit may have a new housekeeping
 * task created for it, and — if so — its real property/building ids.
 * `housekeeping.service.ts`'s `resolveUnitParentsForNewTask` fetches
 * `candidate` by unit id alone (no other filter), so every rejection reason
 * below is decided here, in one pure, unit-testable place, rather than
 * silently folded into a SQL `WHERE` clause that can only say "not found":
 *
 * - `candidate` is `null` — no unit with that id exists at all.
 * - `candidate.workspaceId` doesn't match `workspaceId` — a foreign-workspace
 *   unit id, never trusted from client input.
 * - the unit itself is soft-deleted.
 * - its property or building is archived or soft-deleted (an `out_of_service`
 *   unit is deliberately *not* rejected here — see the module doc comment on
 *   `resolveUnitParentsForNewTask` for why).
 *
 * On success, `propertyId`/`buildingId` are read directly off `candidate` —
 * i.e. off the unit's own current row — never off a client-supplied value.
 */
export function resolveEligibleUnitParents(
  candidate: UnitParentCandidate | null,
  workspaceId: string,
): { propertyId: string; buildingId: string } | null {
  if (!candidate) return null;
  if (candidate.workspaceId !== workspaceId) return null;
  if (candidate.deletedAt !== null) return null;
  if (candidate.propertyArchivedAt !== null || candidate.propertyDeletedAt !== null) return null;
  if (candidate.buildingArchivedAt !== null || candidate.buildingDeletedAt !== null) return null;
  return { propertyId: candidate.propertyId, buildingId: candidate.buildingId };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 1000;
const NOTES_MAX = 1000;

const dueTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const housekeepingTaskInputSchema = z.object({
  unitId: z.uuid("Select a unit"),
  reservationId: z.preprocess(cleanOptional, z.uuid().optional()),
  taskType: z.enum(HOUSEKEEPING_TASK_TYPES),
  priority: z.enum(HOUSEKEEPING_TASK_PRIORITIES).default("normal"),
  assignedTo: z.preprocess(cleanOptional, z.uuid().optional()),
  title: z.string().trim().min(1, "Title is required").max(TITLE_MAX),
  description: z.preprocess(
    cleanOptional,
    z.string().max(DESCRIPTION_MAX).optional(),
  ),
  dueDate: z.preprocess(cleanOptional, z.iso.date().optional()),
  dueTime: z.preprocess(
    cleanOptional,
    z.string().regex(dueTimePattern, "Use HH:MM (24-hour)").optional(),
  ),
  notes: z.preprocess(cleanOptional, z.string().max(NOTES_MAX).optional()),
});
export type HousekeepingTaskInput = z.infer<typeof housekeepingTaskInputSchema>;

/**
 * Unlike `cleanOptional` (which treats a submitted `""` the same as an
 * absent field, both becoming `undefined` — right for every *full-form*
 * field, which is always present in the DOM even when left blank), this
 * preprocessor is for a genuinely *partial* update where the field may be
 * absent from the request entirely (no `<textarea name="notes">` in this
 * particular form/action — `formData.get` then returns `null`) and the
 * caller must be able to tell "not touched" apart from "explicitly cleared
 * to empty": `null` → `undefined` ("leave unchanged"), a real string
 * (including `""` after trimming) is preserved as-is so an intentionally
 * blanked field still validates as a legitimate, distinct value from
 * "absent".
 */
const clearableNotes = (value: unknown) => {
  if (value === null) return undefined;
  if (typeof value === "string") return value.trim();
  return value;
};

/** Employee-safe subset: no unit/reservation/type/priority/assignment fields — only completion notes, which may be explicitly cleared (submitted as `""`) as distinct from left untouched (absent from the request, `null`) — see `clearableNotes`. */
export const housekeepingTaskNotesInputSchema = z.object({
  notes: z.preprocess(clearableNotes, z.string().max(NOTES_MAX).optional()),
});
export type HousekeepingTaskNotesInput = z.infer<
  typeof housekeepingTaskNotesInputSchema
>;

export const housekeepingAssignInputSchema = z.object({
  assignedTo: z.uuid("Select a team member"),
});
export type HousekeepingAssignInput = z.infer<
  typeof housekeepingAssignInputSchema
>;

export const housekeepingTaskFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  quickFilter: z.enum(HOUSEKEEPING_QUICK_FILTERS).catch("all"),
  propertyId: z.union([z.literal("all"), z.uuid()]).catch("all"),
  buildingId: z.union([z.literal("all"), z.uuid()]).catch("all"),
  unitId: z.union([z.literal("all"), z.uuid()]).catch("all"),
  dueDate: z.preprocess(cleanOptional, z.iso.date().optional()),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(25),
});
export type HousekeepingTaskFilters = z.infer<
  typeof housekeepingTaskFiltersSchema
>;

// ---------------------------------------------------------------------------
// Pure decision logic
// ---------------------------------------------------------------------------

/**
 * The housekeeping task lifecycle. `completed` and `cancelled` are terminal.
 * A task must be `assigned` (have an assignee) before it can move to
 * `in_progress` — this is what makes "only assigned/in-progress tasks may be
 * started" a structural guarantee rather than a convention: there's no
 * transition from `pending` directly to `in_progress`.
 */
const TRANSITIONS: Record<
  HousekeepingTaskStatus,
  readonly HousekeepingTaskStatus[]
> = {
  pending: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isValidHousekeepingStatusTransition(
  from: HousekeepingTaskStatus,
  to: HousekeepingTaskStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The valid transition targets from a given status — e.g. for building a UI's status action buttons. */
export function getValidHousekeepingTransitionsFrom(
  status: HousekeepingTaskStatus,
): readonly HousekeepingTaskStatus[] {
  return TRANSITIONS[status];
}

/**
 * A task's `taskType` may only be changed while it's `pending` or `assigned`
 * — never once it's `in_progress` (or terminal). This is the safer rule
 * (rather than allowing an in-progress change and atomically reconciling
 * both the old and new operational conditions): an in-progress cleaning task
 * has already set the unit's `statusOverride` to `cleaning`; changing its
 * type to `maintenance` mid-flight would require correctly unwinding one
 * condition and applying another in the same atomic step, and a task that's
 * already being worked under one label shouldn't silently relabel what the
 * unit is blocked for. Enforced here (service layer) and, for UX, by
 * disabling the field once a task is in progress — but this is the actual
 * guarantee, not the UI.
 */
export function canChangeTaskType(status: HousekeepingTaskStatus): boolean {
  return status === "pending" || status === "assigned";
}

/**
 * The narrower subset of transitions an `employee` may apply directly: start
 * or complete a task already assigned to them. Everything else — assigning,
 * cancelling, or any field other than status/notes — is owner/manager-only.
 * Checked against `isValidHousekeepingStatusTransition` first, so this only
 * ever narrows, never widens, the allowed set.
 */
const EMPLOYEE_TRANSITIONS = new Set(["assigned->in_progress", "in_progress->completed"]);

export function isEmployeeAllowedHousekeepingTransition(
  from: HousekeepingTaskStatus,
  to: HousekeepingTaskStatus,
): boolean {
  return EMPLOYEE_TRANSITIONS.has(`${from}->${to}`);
}

/**
 * THE single source of truth for a unit's operational `statusOverride` —
 * the pure statement of the rule; `housekeeping.service.ts`'s
 * `reconcileUnitOverride` is its SQL mirror, called after every task
 * transition that could affect it (create, start, complete, cancel) rather
 * than deriving the override from whichever transition just happened. This
 * is what makes the result correct under arbitrary interleavings — e.g. a
 * cleaning task active + a maintenance task starting + the maintenance task
 * completing first still resolves to `cleaning` (the cleaning task is still
 * active), not `null`.
 *
 * Priority:
 * 1. `out_of_service` — never automatically changed; a purely manual
 *    condition set/cleared only via the unit's own edit form.
 * 2. `maintenance` — if any operational task of that type is active.
 * 3. `cleaning` — if any operational task of that type is active.
 * 4. `null` — no active operational task.
 */
export function resolveUnitOverride(params: {
  current: UnitConditionOverride | null;
  hasActiveMaintenanceTask: boolean;
  hasActiveCleaningTask: boolean;
}): UnitConditionOverride | null {
  if (params.current === "out_of_service") return "out_of_service";
  if (params.hasActiveMaintenanceTask) return "maintenance";
  if (params.hasActiveCleaningTask) return "cleaning";
  return null;
}

/**
 * THE single source of truth for "is this task overdue" — takes `today`
 * (the workspace's own local calendar date, `YYYY-MM-DD`, from
 * `workspaceTodayDate` in `reservation.ts`) explicitly rather than reading
 * the system/browser clock, so this is deterministic and testable across
 * timezone/midnight boundaries, and so the server (per-task `isOverdue` on
 * `HousekeepingTaskListItem`, computed once per request) and
 * `getHousekeepingMetrics`'s aggregate "overdue" count share one identical
 * definition — a task with no `dueDate` is never overdue, and a
 * `completed`/`cancelled` task never counts, regardless of its due date.
 */
export function isTaskOverdue(params: {
  dueDate: string | null;
  status: HousekeepingTaskStatus;
  today: string;
}): boolean {
  if (params.dueDate === null) return false;
  if (params.status === "completed" || params.status === "cancelled") return false;
  return params.dueDate < params.today;
}

/**
 * List/detail/metrics scope for the current actor, keyed on the actor's own
 * `team_members.id` (not `users.id`) since `housekeepingTasks.assignedTo` FKs
 * to `team_members` — mirrors `resolveReservationScope` in `reservation.ts`.
 * `"none"` covers the (narrow, race-only) case where a non-owner/manager
 * actor has no resolvable active team-member row.
 */
export type HousekeepingScope =
  | { kind: "all" }
  | { kind: "assigned"; teamMemberId: string }
  | { kind: "none" };

export function resolveHousekeepingScope(
  role: string,
  actorTeamMemberId: string | null,
): HousekeepingScope {
  if (role === "owner" || role === "manager") return { kind: "all" };
  if (!actorTeamMemberId) return { kind: "none" };
  return { kind: "assigned", teamMemberId: actorTeamMemberId };
}
