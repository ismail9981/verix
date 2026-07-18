import { alias } from "drizzle-orm/pg-core";
import { and, count, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/db";
import type { Executor } from "../db/executor";
import { NotFoundError } from "./errors";
import {
  buildings,
  housekeepingTasks,
  properties,
  rentalUnits,
  reservations,
  teamMembers,
  users,
} from "../db/schema";
import {
  assertCanAccessHousekeepingTask,
  assertHousekeepingTransitionAllowed,
  assertManagerOrOwnerRole,
} from "../auth/rbac";
import {
  canChangeTaskType,
  isEmployeeAllowedHousekeepingTransition,
  isTaskOverdue,
  isValidHousekeepingStatusTransition,
  resolveEligibleUnitParents,
  resolveHousekeepingScope,
  type HousekeepingScope,
  type HousekeepingTaskFilters,
  type HousekeepingTaskInput,
  type HousekeepingTaskListItem,
  type HousekeepingTaskMetrics,
  type HousekeepingTaskNotesInput,
  type HousekeepingUnitOption,
  type HousekeepingUnitSummary,
} from "../validators/housekeeping";
import { toIanaTimezone, workspaceTodayDate } from "../validators/reservation";
import { assertTeamMemberInWorkspace, resolveActorTeamMemberId } from "./reservation.service";
import { getWorkspaceLocale } from "./rental-unit.service";
import { n, rows } from "./sql-helpers";

/*
 * Housekeeping & unit-operations service (Sprint 13). Every query is scoped
 * to `workspaceId` and excludes soft-deleted rows. On top of tenant
 * isolation, every read/write also applies the actor's role scope
 * (`resolveHousekeepingScope`/`assertCanAccessHousekeepingTask`): an employee
 * only ever sees or touches tasks assigned to them — enforced here, not in
 * the UI. Property/building/unit ids are always derived server-side from the
 * unit itself, never trusted from client input (see `resolveUnitParents`).
 *
 * Every query that runs as part of a caller's transaction takes an
 * `Executor` explicitly, matching `reservation.service.ts`'s convention —
 * see that file's module doc comment for why.
 */

export interface HousekeepingActor {
  userId: string;
  role: string;
}

const assigneeTeamMembers = alias(teamMembers, "hk_assignee_team_members");
const assigneeUsers = alias(users, "hk_assignee_users");
const completerTeamMembers = alias(teamMembers, "hk_completer_team_members");
const completerUsers = alias(users, "hk_completer_users");

const RAW_COLUMNS = {
  id: housekeepingTasks.id,
  propertyId: housekeepingTasks.propertyId,
  propertyName: properties.name,
  buildingId: housekeepingTasks.buildingId,
  buildingName: buildings.name,
  unitId: housekeepingTasks.unitId,
  unitName: rentalUnits.name,
  reservationId: housekeepingTasks.reservationId,
  taskType: housekeepingTasks.taskType,
  status: housekeepingTasks.status,
  priority: housekeepingTasks.priority,
  assignedTo: housekeepingTasks.assignedTo,
  assignedToFullName: assigneeUsers.fullName,
  assignedToEmail: assigneeUsers.email,
  title: housekeepingTasks.title,
  description: housekeepingTasks.description,
  dueDate: housekeepingTasks.dueDate,
  dueTime: housekeepingTasks.dueTime,
  startedAt: housekeepingTasks.startedAt,
  completedAt: housekeepingTasks.completedAt,
  completedBy: housekeepingTasks.completedBy,
  completedByFullName: completerUsers.fullName,
  completedByEmail: completerUsers.email,
  notes: housekeepingTasks.notes,
  createdAt: housekeepingTasks.createdAt,
  updatedAt: housekeepingTasks.updatedAt,
};

type RawRow = Awaited<ReturnType<typeof baseQuery>>[number];

function toListItem(row: RawRow, today: string): HousekeepingTaskListItem {
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    buildingId: row.buildingId,
    buildingName: row.buildingName,
    unitId: row.unitId,
    unitName: row.unitName,
    reservationId: row.reservationId,
    taskType: row.taskType,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assignedTo,
    assignedToName: row.assignedToFullName?.trim() || row.assignedToEmail,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    dueTime: row.dueTime,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    completedBy: row.completedBy,
    completedByName: row.completedByFullName?.trim() || row.completedByEmail,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isOverdue: isTaskOverdue({ dueDate: row.dueDate, status: row.status, today }),
  };
}

function baseQuery(exec: Executor) {
  return exec
    .select(RAW_COLUMNS)
    .from(housekeepingTasks)
    .innerJoin(properties, eq(properties.id, housekeepingTasks.propertyId))
    .innerJoin(buildings, eq(buildings.id, housekeepingTasks.buildingId))
    .innerJoin(rentalUnits, eq(rentalUnits.id, housekeepingTasks.unitId))
    .leftJoin(assigneeTeamMembers, eq(assigneeTeamMembers.id, housekeepingTasks.assignedTo))
    .leftJoin(assigneeUsers, eq(assigneeUsers.id, assigneeTeamMembers.userId))
    .leftJoin(completerTeamMembers, eq(completerTeamMembers.id, housekeepingTasks.completedBy))
    .leftJoin(completerUsers, eq(completerUsers.id, completerTeamMembers.userId));
}

async function resolveScope(
  exec: Executor,
  workspaceId: string,
  actor: HousekeepingActor,
): Promise<HousekeepingScope> {
  if (actor.role === "owner" || actor.role === "manager") return { kind: "all" };
  const actorTeamMemberId = await resolveActorTeamMemberId(exec, workspaceId, actor.userId);
  return resolveHousekeepingScope(actor.role, actorTeamMemberId);
}

async function getRow(
  exec: Executor,
  workspaceId: string,
  id: string,
): Promise<HousekeepingTaskListItem> {
  const [rows, today] = await Promise.all([
    baseQuery(exec).where(
      and(
        eq(housekeepingTasks.id, id),
        eq(housekeepingTasks.workspaceId, workspaceId),
        isNull(housekeepingTasks.deletedAt),
      ),
    ),
    resolveWorkspaceToday(exec, workspaceId),
  ]);
  const row = rows[0];
  if (!row) throw new NotFoundError("Housekeeping task not found.");
  return toListItem(row, today);
}

/** The workspace's own local calendar date (`YYYY-MM-DD`) — the single basis every "is this overdue" decision here uses, never the caller's browser-local clock. */
async function resolveWorkspaceToday(exec: Executor, workspaceId: string): Promise<string> {
  const { timezone } = await getWorkspaceLocale(exec, workspaceId);
  return workspaceTodayDate(timezone);
}

/**
 * A unit's *current* property/building — always re-derived here, never
 * accepted from client input (a client-supplied `propertyId`/`buildingId`
 * could otherwise disagree with the unit's real placement). Fetches the
 * candidate row by unit id alone (no other `WHERE` filter) and delegates
 * every eligibility decision — foreign workspace, soft-deleted unit,
 * archived/soft-deleted property or building — to `resolveEligibleUnitParents`
 * (see that function's doc comment), so the rule is stated once, purely, and
 * is unit-testable independent of the database. Deliberately does **not**
 * check the unit's own `statusOverride` — an `out_of_service` unit must
 * still accept a maintenance task (that's the whole point of flagging it out
 * of service), only a genuinely gone unit/property/building blocks new tasks.
 */
async function resolveUnitParentsForNewTask(
  exec: Executor,
  workspaceId: string,
  unitId: string,
): Promise<{ propertyId: string; buildingId: string }> {
  const rows = await exec
    .select({
      id: rentalUnits.id,
      workspaceId: rentalUnits.workspaceId,
      deletedAt: rentalUnits.deletedAt,
      propertyId: rentalUnits.propertyId,
      propertyArchivedAt: properties.archivedAt,
      propertyDeletedAt: properties.deletedAt,
      buildingId: rentalUnits.buildingId,
      buildingArchivedAt: buildings.archivedAt,
      buildingDeletedAt: buildings.deletedAt,
    })
    .from(rentalUnits)
    .innerJoin(properties, eq(properties.id, rentalUnits.propertyId))
    .innerJoin(buildings, eq(buildings.id, rentalUnits.buildingId))
    .where(eq(rentalUnits.id, unitId));

  const resolved = resolveEligibleUnitParents(rows[0] ?? null, workspaceId);
  if (!resolved) {
    throw new Error(
      "Unit not found, or its property/building is archived — new tasks can't be created for it.",
    );
  }
  return resolved;
}

/**
 * Shared by every "list units in this workspace whose property/building is
 * still active" query below — not soft-deleted, under a property/building
 * that isn't archived or soft-deleted. Mirrors `resolveEligibleUnitParents`'s
 * conditions (kept as a direct SQL `WHERE` here, rather than fetching every
 * unit and filtering in-process, since these back list endpoints rather than
 * a single lookup). Deliberately says nothing about `out_of_service` —
 * that's a per-caller policy decision layered on top (see
 * `listEligibleTaskUnitOptions` vs `listHousekeepingUnitFilterOptions`
 * below), not part of "is this unit's placement still active."
 */
function activeUnitPlacementWhere(workspaceId: string): SQL {
  return and(
    eq(rentalUnits.workspaceId, workspaceId),
    isNull(rentalUnits.deletedAt),
    isNull(properties.deletedAt),
    isNull(properties.archivedAt),
    isNull(buildings.deletedAt),
    isNull(buildings.archivedAt),
  )!;
}

function unitOptionsQuery(workspaceId: string) {
  return db
    .select({
      id: rentalUnits.id,
      name: rentalUnits.name,
      propertyName: properties.name,
      buildingName: buildings.name,
    })
    .from(rentalUnits)
    .innerJoin(properties, eq(properties.id, rentalUnits.propertyId))
    .innerJoin(buildings, eq(buildings.id, rentalUnits.buildingId))
    .where(activeUnitPlacementWhere(workspaceId))
    .orderBy(properties.name, buildings.name, rentalUnits.name);
}

/**
 * Units eligible to have a *new task created* for them — deliberately does
 * **not** exclude `out_of_service` units, unlike `rental-unit.service.ts`'s
 * `listRentalUnitOptions` (used for *reservations*, where an out-of-service
 * unit correctly can't be booked): an out-of-service unit is exactly the one
 * that most needs a maintenance task.
 */
export async function listEligibleTaskUnitOptions(
  workspaceId: string,
): Promise<HousekeepingUnitOption[]> {
  return unitOptionsQuery(workspaceId);
}

/**
 * Units offered by the Housekeeping page's own "Unit" filter — a distinct
 * query from `listEligibleTaskUnitOptions` even though today's conditions
 * happen to match, because the two represent different questions ("can a
 * *new* task be created for this unit" vs "should this unit be filterable
 * on the task list") that may diverge later (e.g. the filter might someday
 * also want to surface archived units for historical tasks). Must **not**
 * exclude `out_of_service` units — that's exactly the unit a manager is
 * most likely to want to filter task history down to.
 */
export async function listHousekeepingUnitFilterOptions(
  workspaceId: string,
): Promise<HousekeepingUnitOption[]> {
  return unitOptionsQuery(workspaceId);
}

/** A linked reservation must belong to the same workspace *and* the same unit as the task. */
async function assertReservationConsistent(
  exec: Executor,
  workspaceId: string,
  unitId: string,
  reservationId: string,
): Promise<void> {
  const rows = await exec
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      and(
        eq(reservations.id, reservationId),
        eq(reservations.workspaceId, workspaceId),
        eq(reservations.unitId, unitId),
        isNull(reservations.deletedAt),
      ),
    );
  if (!rows[0]) {
    throw new Error("The linked reservation must belong to this unit and workspace.");
  }
}

/**
 * THE single source of truth for a unit's operational `statusOverride`.
 * Called after every housekeeping task transition that could possibly affect
 * it (create, start, complete, cancel — see each function below), rather
 * than deriving the override from whatever transition just happened. This is
 * what makes the result correct under arbitrary interleavings: a cleaning
 * task active + a maintenance task starting + the maintenance task
 * completing first, for example, re-resolves to `cleaning` (since that task
 * is still `in_progress`) instead of `null` — the earlier design cleared
 * per-condition from the triggering transition alone and could leave a
 * unit reading `available` while a cleaning task was still active; this
 * always inspects the unit's *entire* current task set instead.
 *
 * Priority, matching `resolveUnitOverride` in `validators/housekeeping.ts`
 * (that pure function is the statement of this rule; this is its SQL
 * mirror, so it holds under concurrent transactions, not just in-process):
 * 1. `out_of_service` — never touched here; a manual condition, only ever
 *    set/cleared via the unit's own edit form.
 * 2. `maintenance` — if any `in_progress` maintenance task exists for the unit.
 * 3. `cleaning` — if any `in_progress` cleaning task exists for the unit.
 * 4. `null` — otherwise (no active operational task).
 *
 * A single atomic `UPDATE` (the `CASE` reads `status_override`'s row value
 * under the UPDATE's own lock), not a read-then-write pair — safe under
 * concurrent reconciliation calls for the same unit.
 */
async function reconcileUnitOverride(tx: Executor, unitId: string): Promise<void> {
  await tx.execute(sql`
    update ${rentalUnits}
    set status_override = case
      when status_override = 'out_of_service' then status_override
      when exists (
        select 1 from ${housekeepingTasks}
        where ${housekeepingTasks.unitId} = ${unitId}
          and ${housekeepingTasks.taskType} = 'maintenance'
          and ${housekeepingTasks.status} = 'in_progress'
          and ${housekeepingTasks.deletedAt} is null
      ) then 'maintenance'
      when exists (
        select 1 from ${housekeepingTasks}
        where ${housekeepingTasks.unitId} = ${unitId}
          and ${housekeepingTasks.taskType} = 'cleaning'
          and ${housekeepingTasks.status} = 'in_progress'
          and ${housekeepingTasks.deletedAt} is null
      ) then 'cleaning'
      else null
    end
    where ${rentalUnits.id} = ${unitId}
  `);
}

function buildFilterWhere(
  workspaceId: string,
  scope: HousekeepingScope,
  filters: HousekeepingTaskFilters,
): SQL[] {
  const where = [
    eq(housekeepingTasks.workspaceId, workspaceId),
    isNull(housekeepingTasks.deletedAt),
  ];
  if (scope.kind === "assigned") {
    where.push(eq(housekeepingTasks.assignedTo, scope.teamMemberId));
  }

  switch (filters.quickFilter) {
    case "pending":
    case "assigned":
    case "in_progress":
    case "completed":
    case "cancelled":
      where.push(eq(housekeepingTasks.status, filters.quickFilter));
      break;
    case "cleaning":
    case "maintenance":
      where.push(eq(housekeepingTasks.taskType, filters.quickFilter));
      break;
    case "urgent":
      where.push(eq(housekeepingTasks.priority, "urgent"));
      break;
    case "unassigned":
      where.push(isNull(housekeepingTasks.assignedTo));
      break;
    case "assigned_to_me":
      // Handled by `listHousekeepingTasks` narrowing `scope` to the actor's
      // own team-member id *before* calling this — the `scope.kind ===
      // "assigned"` push above already covers it, so no extra clause here.
      break;
    default:
      break;
  }

  if (filters.propertyId !== "all") where.push(eq(housekeepingTasks.propertyId, filters.propertyId));
  if (filters.buildingId !== "all") where.push(eq(housekeepingTasks.buildingId, filters.buildingId));
  if (filters.unitId !== "all") where.push(eq(housekeepingTasks.unitId, filters.unitId));
  if (filters.dueDate) where.push(eq(housekeepingTasks.dueDate, filters.dueDate));
  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push(or(ilike(housekeepingTasks.title, term), ilike(rentalUnits.name, term))!);
  }

  return where;
}

/** Workspace-wide building options (not scoped to one property) — for the housekeeping filter bar's "Building" select, which filters across the whole workspace rather than one property at a time (unlike `building.service.ts`'s `listBuildingOptions`, which is property-scoped for the property-management UI). */
export async function listWorkspaceBuildingOptions(
  workspaceId: string,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: buildings.id, name: buildings.name })
    .from(buildings)
    .where(
      and(eq(buildings.workspaceId, workspaceId), isNull(buildings.deletedAt), isNull(buildings.archivedAt)),
    )
    .orderBy(buildings.name);
}

export async function listHousekeepingTasks(
  workspaceId: string,
  actor: HousekeepingActor,
  filters: HousekeepingTaskFilters,
): Promise<{ items: HousekeepingTaskListItem[]; total: number }> {
  let scope = await resolveScope(db, workspaceId, actor);
  if (scope.kind === "none") return { items: [], total: 0 };

  // "assigned_to_me" narrows scope for every role (including owner/manager),
  // not just employees — resolved here since `buildFilterWhere` is pure and
  // has no db access of its own.
  if (filters.quickFilter === "assigned_to_me" && scope.kind === "all") {
    const actorTeamMemberId = await resolveActorTeamMemberId(db, workspaceId, actor.userId);
    scope = actorTeamMemberId ? { kind: "assigned", teamMemberId: actorTeamMemberId } : { kind: "none" };
    if (scope.kind === "none") return { items: [], total: 0 };
  }

  const where = and(...buildFilterWhere(workspaceId, scope, filters))!;
  const offset = (filters.page - 1) * filters.pageSize;

  // The count query only needs the rentalUnits join when `search` is active
  // (buildFilterWhere's only clause that references rentalUnits.name) —
  // skipping it otherwise avoids an unnecessary join on the common,
  // no-search-term path of every paginated list request.
  const countQuery = filters.search
    ? db
        .select({ total: count() })
        .from(housekeepingTasks)
        .innerJoin(rentalUnits, eq(rentalUnits.id, housekeepingTasks.unitId))
        .where(where)
    : db.select({ total: count() }).from(housekeepingTasks).where(where);

  const [rows, totalRows, today] = await Promise.all([
    baseQuery(db)
      .where(where)
      .orderBy(housekeepingTasks.dueDate, housekeepingTasks.createdAt)
      .limit(filters.pageSize)
      .offset(offset),
    countQuery,
    resolveWorkspaceToday(db, workspaceId),
  ]);

  return { items: rows.map((row) => toListItem(row, today)), total: totalRows[0]?.total ?? 0 };
}

export async function getHousekeepingTask(
  workspaceId: string,
  id: string,
  actor: HousekeepingActor,
): Promise<HousekeepingTaskListItem> {
  const row = await getRow(db, workspaceId, id);
  const actorTeamMemberId =
    actor.role === "owner" || actor.role === "manager"
      ? null
      : await resolveActorTeamMemberId(db, workspaceId, actor.userId);
  assertCanAccessHousekeepingTask({
    role: actor.role,
    actorTeamMemberId: actorTeamMemberId ?? "",
    assignedTeamMemberId: row.assignedTo,
  });
  return row;
}

/** Owner/manager only. Status is derived (never client-supplied): `assigned` if `assignedTo` is given, otherwise `pending`. */
export async function createHousekeepingTask(
  workspaceId: string,
  input: HousekeepingTaskInput,
  actor: HousekeepingActor,
): Promise<HousekeepingTaskListItem> {
  assertManagerOrOwnerRole(actor.role);

  return db.transaction(async (tx) => {
    const actorTeamMemberId = await resolveActorTeamMemberId(tx, workspaceId, actor.userId);
    const { propertyId, buildingId } = await resolveUnitParentsForNewTask(tx, workspaceId, input.unitId);

    if (input.reservationId) {
      await assertReservationConsistent(tx, workspaceId, input.unitId, input.reservationId);
    }
    if (input.assignedTo) {
      await assertTeamMemberInWorkspace(tx, workspaceId, input.assignedTo);
    }

    const inserted = await tx
      .insert(housekeepingTasks)
      .values({
        workspaceId,
        propertyId,
        buildingId,
        unitId: input.unitId,
        reservationId: input.reservationId ?? null,
        taskType: input.taskType,
        status: input.assignedTo ? "assigned" : "pending",
        priority: input.priority,
        assignedTo: input.assignedTo ?? null,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
        notes: input.notes ?? null,
        createdBy: actorTeamMemberId,
      })
      .returning({ id: housekeepingTasks.id });

    if (input.taskType === "cleaning" || input.taskType === "maintenance") {
      await reconcileUnitOverride(tx, input.unitId);
    }

    return getRow(tx, workspaceId, inserted[0]!.id);
  });
}

/**
 * Owner/manager only, scope-locked edit: taskType/priority/title/description/
 * due date+time/notes/reservation link. Never touches `unitId` (immutable
 * after creation, mirroring `rental-unit.service.ts`'s placement convention)
 * or `assignedTo` (see `assignHousekeepingTask` — kept as the single place
 * that field changes, rather than two paths that can change it).
 */
/**
 * Full edit: taskType/priority/title/description/due date+time/notes, plus
 * `reservationId` only when the caller actually supplies one.
 *
 * `reservationId` is **never** cleared as a side effect of an unrelated
 * edit: no housekeeping form renders a `reservationId` input (it's only
 * ever set automatically by `ensureCheckoutCleaningTask`), so
 * `input.reservationId` is `undefined` on every real-world call here — an
 * *absent* field means "leave unchanged", not "set null" (mirrors
 * `completeHousekeepingTask`'s identical `notes` handling below). Without
 * this, saving any unrelated field (e.g. bumping priority) on an
 * automatically-created checkout task would silently null out the very
 * link `ensureCheckoutCleaningTask`'s idempotency check depends on. There
 * is deliberately no supported way to *clear* an existing reservationId —
 * only to set one that wasn't there, or leave it alone.
 */
export async function updateHousekeepingTask(
  workspaceId: string,
  id: string,
  input: HousekeepingTaskInput,
  actor: HousekeepingActor,
): Promise<HousekeepingTaskListItem> {
  assertManagerOrOwnerRole(actor.role);

  return db.transaction(async (tx) => {
    const current = await tx
      .select({
        unitId: housekeepingTasks.unitId,
        status: housekeepingTasks.status,
        taskType: housekeepingTasks.taskType,
      })
      .from(housekeepingTasks)
      .where(
        and(
          eq(housekeepingTasks.id, id),
          eq(housekeepingTasks.workspaceId, workspaceId),
          isNull(housekeepingTasks.deletedAt),
        ),
      );
    const currentRow = current[0];
    if (!currentRow) throw new Error("Housekeeping task not found.");

    if (input.unitId !== currentRow.unitId) {
      throw new Error("A task's unit can't be changed after creation.");
    }
    if (input.taskType !== currentRow.taskType && !canChangeTaskType(currentRow.status)) {
      throw new Error("A task's type can only be changed while it's pending or assigned.");
    }
    if (input.reservationId !== undefined) {
      await assertReservationConsistent(tx, workspaceId, currentRow.unitId, input.reservationId);
    }

    await tx
      .update(housekeepingTasks)
      .set({
        ...(input.reservationId !== undefined ? { reservationId: input.reservationId } : {}),
        taskType: input.taskType,
        priority: input.priority,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
        notes: input.notes ?? null,
      })
      .where(eq(housekeepingTasks.id, id));

    return getRow(tx, workspaceId, id);
  });
}

/** Owner/manager only. Assigning a `pending` task also transitions it to `assigned`; assigning an already-`assigned`/`in_progress` task just changes who's on it. */
export async function assignHousekeepingTask(
  workspaceId: string,
  id: string,
  assignedTo: string,
  actor: HousekeepingActor,
): Promise<HousekeepingTaskListItem> {
  assertManagerOrOwnerRole(actor.role);

  return db.transaction(async (tx) => {
    const current = await tx
      .select({ status: housekeepingTasks.status })
      .from(housekeepingTasks)
      .where(
        and(
          eq(housekeepingTasks.id, id),
          eq(housekeepingTasks.workspaceId, workspaceId),
          isNull(housekeepingTasks.deletedAt),
        ),
      );
    const currentRow = current[0];
    if (!currentRow) throw new Error("Housekeeping task not found.");
    if (currentRow.status === "completed" || currentRow.status === "cancelled") {
      throw new Error("Completed or cancelled tasks can't be reassigned.");
    }

    await assertTeamMemberInWorkspace(tx, workspaceId, assignedTo);

    await tx
      .update(housekeepingTasks)
      .set({
        assignedTo,
        status: currentRow.status === "pending" ? "assigned" : currentRow.status,
      })
      .where(eq(housekeepingTasks.id, id));

    return getRow(tx, workspaceId, id);
  });
}

/** Loads a task's mutation-relevant fields with a row lock, held for the duration of the caller's transaction. */
async function lockTaskRow(
  tx: Executor,
  workspaceId: string,
  id: string,
): Promise<{
  status: HousekeepingTaskListItem["status"];
  unitId: string;
  assignedTo: string | null;
  taskType: HousekeepingTaskListItem["taskType"];
}> {
  const rows = await tx
    .select({
      status: housekeepingTasks.status,
      unitId: housekeepingTasks.unitId,
      assignedTo: housekeepingTasks.assignedTo,
      taskType: housekeepingTasks.taskType,
    })
    .from(housekeepingTasks)
    .where(
      and(
        eq(housekeepingTasks.id, id),
        eq(housekeepingTasks.workspaceId, workspaceId),
        isNull(housekeepingTasks.deletedAt),
      ),
    )
    .for("update");
  const row = rows[0];
  if (!row) throw new Error("Housekeeping task not found.");
  return row;
}

/** Starting a task: `status = in_progress`, `started_at` stamped, and (for cleaning/maintenance) the unit's condition override set per the priority rule. Employees may only start a task assigned to them. */
export async function startHousekeepingTask(
  workspaceId: string,
  id: string,
  actor: HousekeepingActor,
): Promise<HousekeepingTaskListItem> {
  return db.transaction(async (tx) => {
    const row = await lockTaskRow(tx, workspaceId, id);
    const actorTeamMemberId =
      actor.role === "owner" || actor.role === "manager"
        ? null
        : await resolveActorTeamMemberId(tx, workspaceId, actor.userId);
    assertCanAccessHousekeepingTask({
      role: actor.role,
      actorTeamMemberId: actorTeamMemberId ?? "",
      assignedTeamMemberId: row.assignedTo,
    });
    assertHousekeepingTransitionAllowed(
      actor.role,
      isValidHousekeepingStatusTransition(row.status, "in_progress"),
      isEmployeeAllowedHousekeepingTransition(row.status, "in_progress"),
    );

    await tx
      .update(housekeepingTasks)
      .set({ status: "in_progress", startedAt: new Date() })
      .where(eq(housekeepingTasks.id, id));

    if (row.taskType === "cleaning" || row.taskType === "maintenance") {
      await reconcileUnitOverride(tx, row.unitId);
    }

    return getRow(tx, workspaceId, id);
  });
}

/**
 * Completing a task: `status = completed`, `completed_at`/`completed_by`
 * stamped, optional notes, and (for cleaning/maintenance) reconciling the
 * unit's override. Employees may only complete a task assigned to them, and
 * may only set `notes`.
 *
 * `notesInput?.notes === undefined` (the field was absent from the request)
 * leaves the existing notes untouched; `notesInput.notes === ""` (submitted
 * as an explicit, deliberate clear — see `clearableNotes` in
 * `validators/housekeeping.ts`) persists as `null`, matching this schema's
 * existing "empty means null in the database" convention for every other
 * optional text field.
 */
export async function completeHousekeepingTask(
  workspaceId: string,
  id: string,
  actor: HousekeepingActor,
  notesInput?: HousekeepingTaskNotesInput,
): Promise<HousekeepingTaskListItem> {
  return db.transaction(async (tx) => {
    const row = await lockTaskRow(tx, workspaceId, id);
    const actorTeamMemberId = await resolveActorTeamMemberId(tx, workspaceId, actor.userId);
    assertCanAccessHousekeepingTask({
      role: actor.role,
      actorTeamMemberId: actorTeamMemberId ?? "",
      assignedTeamMemberId: row.assignedTo,
    });
    assertHousekeepingTransitionAllowed(
      actor.role,
      isValidHousekeepingStatusTransition(row.status, "completed"),
      isEmployeeAllowedHousekeepingTransition(row.status, "completed"),
    );

    await tx
      .update(housekeepingTasks)
      .set({
        status: "completed",
        completedAt: new Date(),
        completedBy: actorTeamMemberId,
        ...(notesInput?.notes !== undefined ? { notes: notesInput.notes || null } : {}),
      })
      .where(eq(housekeepingTasks.id, id));

    if (row.taskType === "cleaning" || row.taskType === "maintenance") {
      await reconcileUnitOverride(tx, row.unitId);
    }

    return getRow(tx, workspaceId, id);
  });
}

/**
 * Owner/manager only. Preserves audit history: cancelling only changes
 * `status`, never soft-deletes the row. Also reconciles the unit's override
 * (for cleaning/maintenance tasks) — otherwise an abandoned in-progress task
 * would leave the unit stuck under that condition forever (the "unit
 * override drift" the spec explicitly warns against).
 */
export async function cancelHousekeepingTask(
  workspaceId: string,
  id: string,
  actor: HousekeepingActor,
): Promise<HousekeepingTaskListItem> {
  assertManagerOrOwnerRole(actor.role);

  return db.transaction(async (tx) => {
    const row = await lockTaskRow(tx, workspaceId, id);
    assertHousekeepingTransitionAllowed(
      actor.role,
      isValidHousekeepingStatusTransition(row.status, "cancelled"),
      false,
    );

    await tx
      .update(housekeepingTasks)
      .set({ status: "cancelled" })
      .where(eq(housekeepingTasks.id, id));

    if (row.taskType === "cleaning" || row.taskType === "maintenance") {
      await reconcileUnitOverride(tx, row.unitId);
    }

    return getRow(tx, workspaceId, id);
  });
}

/**
 * Ensures exactly one non-deleted `cleaning` task exists for `reservationId`
 * — called from `reservation.service.ts`'s `updateReservationStatus` inside
 * its own transaction when a reservation transitions `checked_in` ->
 * `checked_out`. Idempotent under retry: select existing, else insert with
 * `onConflictDoNothing` against the partial unique index
 * (`housekeeping_checkout_task_uq`), else re-select the row a concurrent
 * writer just inserted — mirrors `settings.service.ts`'s `ensureSettingsRow`.
 * Never blocked by an archived/soft-deleted property or building: the
 * reservation transition itself must always succeed, and a best-effort
 * cleaning task is a helpful side effect, not a gate on it.
 */
export async function ensureCheckoutCleaningTask(
  tx: Executor,
  workspaceId: string,
  reservationId: string,
  unit: { id: string; propertyId: string; buildingId: string },
): Promise<string> {
  const existing = await tx
    .select({ id: housekeepingTasks.id })
    .from(housekeepingTasks)
    .where(
      and(
        eq(housekeepingTasks.reservationId, reservationId),
        eq(housekeepingTasks.taskType, "cleaning"),
        isNull(housekeepingTasks.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const inserted = await tx
    .insert(housekeepingTasks)
    .values({
      workspaceId,
      propertyId: unit.propertyId,
      buildingId: unit.buildingId,
      unitId: unit.id,
      reservationId,
      taskType: "cleaning",
      status: "pending",
      priority: "normal",
      title: "Checkout cleaning",
    })
    .onConflictDoNothing({
      target: [housekeepingTasks.reservationId, housekeepingTasks.taskType],
      where: sql`reservation_id is not null and task_type = 'cleaning' and deleted_at is null`,
    })
    .returning({ id: housekeepingTasks.id });
  if (inserted[0]) return inserted[0].id;

  // Lost an insert race — read the row the other writer created.
  const again = await tx
    .select({ id: housekeepingTasks.id })
    .from(housekeepingTasks)
    .where(
      and(
        eq(housekeepingTasks.reservationId, reservationId),
        eq(housekeepingTasks.taskType, "cleaning"),
        isNull(housekeepingTasks.deletedAt),
      ),
    )
    .limit(1);
  return again[0]!.id;
}

/**
 * Scoped identically to `listHousekeepingTasks` (owner/manager see the whole
 * workspace; an employee sees only their own assigned-task counts) — a
 * single grouped/filtered SQL aggregate, not a full row fetch, so this stays
 * cheap regardless of task history. "Today"/"overdue" use the workspace's own
 * local calendar date, not the server's.
 */
export async function getHousekeepingMetrics(
  workspaceId: string,
  actor: HousekeepingActor,
): Promise<HousekeepingTaskMetrics> {
  const [scope, { timezone }] = await Promise.all([
    resolveScope(db, workspaceId, actor),
    getWorkspaceLocale(db, workspaceId),
  ]);
  if (scope.kind === "none") {
    return { pending: 0, assigned: 0, inProgress: 0, completedToday: 0, overdue: 0, urgent: 0, unassigned: 0 };
  }

  const today = workspaceTodayDate(timezone);
  const iana = toIanaTimezone(timezone);

  const scopeClause =
    scope.kind === "assigned" ? sql`and assigned_to = ${scope.teamMemberId}` : sql``;

  const [row] = await rows<{
    pending: unknown;
    assigned: unknown;
    inProgress: unknown;
    completedToday: unknown;
    overdue: unknown;
    urgent: unknown;
    unassigned: unknown;
  }>(
    db,
    sql`
      select
        count(*) filter (where status = 'pending') as "pending",
        count(*) filter (where status = 'assigned') as "assigned",
        count(*) filter (where status = 'in_progress') as "inProgress",
        count(*) filter (where status = 'completed' and (completed_at at time zone ${iana})::date = ${today}) as "completedToday",
        count(*) filter (where status not in ('completed', 'cancelled') and due_date < ${today}) as "overdue",
        count(*) filter (where priority = 'urgent' and status not in ('completed', 'cancelled')) as "urgent",
        count(*) filter (where assigned_to is null and status not in ('completed', 'cancelled')) as "unassigned"
      from housekeeping_tasks
      where workspace_id = ${workspaceId} and deleted_at is null ${scopeClause}
    `,
  );

  return {
    pending: n(row?.pending),
    assigned: n(row?.assigned),
    inProgress: n(row?.inProgress),
    completedToday: n(row?.completedToday),
    overdue: n(row?.overdue),
    urgent: n(row?.urgent),
    unassigned: n(row?.unassigned),
  };
}

/** Units currently under a cleaning/maintenance condition override, for the dashboard widget and the housekeeping page header. Visible to every role (mirrors Property Management's unit-status counts). */
export async function getHousekeepingUnitSummary(
  workspaceId: string,
): Promise<HousekeepingUnitSummary> {
  const [row] = await rows<{ underCleaning: unknown; underMaintenance: unknown }>(
    db,
    sql`
      select
        count(*) filter (where status_override = 'cleaning') as "underCleaning",
        count(*) filter (where status_override = 'maintenance') as "underMaintenance"
      from rental_units
      where workspace_id = ${workspaceId} and deleted_at is null
    `,
  );
  return { unitsUnderCleaning: n(row?.underCleaning), unitsUnderMaintenance: n(row?.underMaintenance) };
}

/** Overdue count for the dashboard's compact summary widget, scoped the same way as `getHousekeepingMetrics`. */
export async function getHousekeepingDashboardSummary(
  workspaceId: string,
  actor: HousekeepingActor,
): Promise<{
  pending: number;
  inProgress: number;
  overdue: number;
  unitsUnderCleaning: number;
  unitsUnderMaintenance: number;
}> {
  const [metrics, unitSummary] = await Promise.all([
    getHousekeepingMetrics(workspaceId, actor),
    getHousekeepingUnitSummary(workspaceId),
  ]);
  return {
    pending: metrics.pending,
    inProgress: metrics.inProgress,
    overdue: metrics.overdue,
    unitsUnderCleaning: unitSummary.unitsUnderCleaning,
    unitsUnderMaintenance: unitSummary.unitsUnderMaintenance,
  };
}

