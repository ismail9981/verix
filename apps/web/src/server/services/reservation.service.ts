import { and, eq, gt, ilike, isNull, lt, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/db";
import type { Executor } from "../db/executor";
import { customers, rentalUnits, reservations, teamMembers, users } from "../db/schema";
import {
  assertCanAccessReservation,
  assertManagerOrOwnerRole,
  assertStatusTransitionAllowed,
} from "../auth/rbac";
import {
  NON_BLOCKING_STATUSES,
  isEmployeeAllowedTransition,
  isValidInitialStatus,
  isValidReservationStatusTransition,
  resolveReservationScope,
  workspaceTodayDate,
  type ReservationFilters,
  type ReservationInput,
  type ReservationListItem,
  type ReservationMetrics,
  type ReservationPersonOption,
  type ReservationScope,
  type ReservationStatusValue,
} from "../validators/reservation";
import {
  bookableRentalUnitIdsQuery,
  countActiveRentalUnits,
  getWorkspaceLocale,
  isUnitBookable,
} from "./rental-unit.service";

/*
 * Reservations service — the rental/stay core. Every query is scoped to
 * `workspaceId` and excludes soft-deleted rows. On top of tenant isolation,
 * every read/write also applies the actor's *role scope*
 * (`resolveReservationScope`/`assertCanAccessReservation`): an employee only
 * ever sees or touches reservations staffed to them — enforced here, not in
 * the UI. Overlap prevention is enforced twice: a friendly pre-check here
 * (clear error message) and, as the actual race-safe guarantee, a partial
 * EXCLUDE constraint in the database (see `drizzle/0011_reservations.sql`).
 *
 * Every query that runs as part of a caller's transaction takes an `Executor`
 * (either `db` or the transaction's `tx`) explicitly, rather than reaching for
 * the module-level `db` — a query that silently used `db` from inside
 * `db.transaction(async (tx) => ...)` would run outside that transaction's
 * connection/snapshot despite feeding data the transaction inserts.
 */

export interface ReservationActor {
  userId: string;
  role: string;
}

const RAW_COLUMNS = {
  id: reservations.id,
  unitId: reservations.unitId,
  unitName: rentalUnits.name,
  customerId: reservations.customerId,
  customerName: customers.name,
  staffId: reservations.staffId,
  staffFullName: users.fullName,
  staffEmail: users.email,
  status: reservations.status,
  checkInDate: reservations.checkInDate,
  checkOutDate: reservations.checkOutDate,
  priceCents: reservations.priceCents,
  currency: reservations.currency,
  source: reservations.source,
  notes: reservations.notes,
  createdAt: reservations.createdAt,
};

type RawRow = {
  id: string;
  unitId: string;
  unitName: string;
  customerId: string;
  customerName: string;
  staffId: string | null;
  staffFullName: string | null;
  staffEmail: string | null;
  status: ReservationStatusValue;
  checkInDate: string;
  checkOutDate: string;
  priceCents: number;
  currency: string;
  source: ReservationListItem["source"];
  notes: string | null;
  createdAt: Date;
};

function toListItem(row: RawRow): ReservationListItem {
  return {
    id: row.id,
    unitId: row.unitId,
    unitName: row.unitName,
    customerId: row.customerId,
    customerName: row.customerName,
    staffId: row.staffId,
    staffName: row.staffFullName?.trim() || row.staffEmail,
    status: row.status,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    priceCents: row.priceCents,
    currency: row.currency,
    source: row.source,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

function baseQuery(exec: Executor) {
  return exec
    .select(RAW_COLUMNS)
    .from(reservations)
    .innerJoin(rentalUnits, eq(rentalUnits.id, reservations.unitId))
    .innerJoin(customers, eq(customers.id, reservations.customerId))
    .leftJoin(teamMembers, eq(teamMembers.id, reservations.staffId))
    .leftJoin(users, eq(users.id, teamMembers.userId));
}

/** The caller's own `team_members.id` in this workspace — needed to scope employee visibility and validate staff assignment. Owners/managers get one too (provisioned by `getAuthorizedWorkspace`). */
async function resolveActorTeamMemberId(
  exec: Executor,
  workspaceId: string,
  userId: string,
): Promise<string | null> {
  const rows = await exec
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.workspaceId, workspaceId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, "active"),
        isNull(teamMembers.deletedAt),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * The actor's list/detail visibility scope. Owners/managers always see
 * everything and never need their own `team_members.id` resolved to know
 * that — short-circuits before the lookup, sparing a wasted round-trip on
 * what's likely the most common caller role.
 */
async function resolveScope(
  exec: Executor,
  workspaceId: string,
  actor: ReservationActor,
): Promise<ReservationScope> {
  if (actor.role === "owner" || actor.role === "manager") return { kind: "all" };
  const actorTeamMemberId = await resolveActorTeamMemberId(exec, workspaceId, actor.userId);
  return resolveReservationScope(actor.role, actorTeamMemberId);
}

/**
 * `requireActive: false` allows a staff member who's been deactivated (or
 * soft-deleted/removed from the team entirely) since the reservation was
 * assigned to them — used only when the reservation being updated is
 * *keeping* its current staff assignment, so editing an unrelated field
 * doesn't fail (or worse, silently drop the assignment — see the caller)
 * just because the staff member later left. Reassigning to a *different*
 * staff member always requires them to still be an active team member.
 */
async function assertTeamMemberInWorkspace(
  exec: Executor,
  workspaceId: string,
  teamMemberId: string,
  options: { requireActive?: boolean } = {},
): Promise<void> {
  const { requireActive = true } = options;
  const where = [eq(teamMembers.id, teamMemberId), eq(teamMembers.workspaceId, workspaceId)];
  if (requireActive) {
    where.push(eq(teamMembers.status, "active"));
    where.push(isNull(teamMembers.deletedAt));
  }
  const rows = await exec.select({ id: teamMembers.id }).from(teamMembers).where(and(...where));
  if (!rows[0]) {
    throw new Error(
      requireActive ? "Staff member not found or no longer active." : "Staff member not found in workspace.",
    );
  }
}

/**
 * `requireActive: false` allows a unit that's been flagged `out_of_service`
 * *or soft-deleted* since the reservation was made — used only when the
 * reservation being updated is *keeping* its current unit assignment, so
 * editing an unrelated field (e.g. notes) on an old reservation doesn't fail
 * just because the unit was later taken out of service or removed.
 * Reassigning to a *different* unit always requires it to still be bookable
 * (not soft-deleted, not flagged `out_of_service` — see
 * `rental-unit.service.ts`'s `countActiveRentalUnits`/`listRentalUnitOptions`
 * for the same "bookable" definition; `cleaning`/`maintenance` are transient
 * conditions and don't block booking a unit for a future date range).
 */
async function assertUnitInWorkspace(
  exec: Executor,
  workspaceId: string,
  unitId: string,
  options: { requireActive?: boolean } = {},
): Promise<void> {
  const { requireActive = true } = options;
  const where = [eq(rentalUnits.id, unitId), eq(rentalUnits.workspaceId, workspaceId)];
  if (requireActive) {
    where.push(isNull(rentalUnits.deletedAt));
    where.push(isUnitBookable());
  }

  const rows = await exec.select({ id: rentalUnits.id }).from(rentalUnits).where(and(...where));
  if (!rows[0]) {
    throw new Error(
      requireActive ? "Unit not found or no longer active." : "Unit not found in workspace.",
    );
  }
}

async function assertCustomerInWorkspace(
  exec: Executor,
  workspaceId: string,
  customerId: string,
): Promise<void> {
  const rows = await exec
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.workspaceId, workspaceId),
        isNull(customers.deletedAt),
      ),
    );
  if (!rows[0]) throw new Error("Customer not found in workspace.");
}

/** Thrown when a unit is already reserved for an overlapping date range. */
export const OVERLAP_ERROR = "This unit is already booked for the selected dates.";

/** Postgres error code for an EXCLUDE-constraint violation — the race-safe fallback behind the pre-check below. */
const EXCLUSION_VIOLATION = "23P01";

/**
 * The friendly pre-check backing `OVERLAP_ERROR`. The actual race-safe
 * guarantee is the database's partial EXCLUDE constraint
 * (`reservations_no_overlap_excl`) — this only improves the common-case error
 * message before hitting it. Necessarily a separate expression (SQL
 * `lt`/`gt` conditions, not a call to `doDateRangesOverlap`) since this runs
 * as part of the query planner rather than over in-process values, but it
 * encodes the identical half-open-interval formula documented there.
 */
async function checkAvailability(
  exec: Executor,
  workspaceId: string,
  unitId: string,
  checkInDate: string,
  checkOutDate: string,
  excludeReservationId?: string,
): Promise<boolean> {
  const where = [
    eq(reservations.workspaceId, workspaceId),
    eq(reservations.unitId, unitId),
    isNull(reservations.deletedAt),
    notInArray(reservations.status, NON_BLOCKING_STATUSES),
    lt(reservations.checkInDate, checkOutDate),
    gt(reservations.checkOutDate, checkInDate),
  ];
  if (excludeReservationId) where.push(ne(reservations.id, excludeReservationId));

  const rows = await exec.select({ id: reservations.id }).from(reservations).where(and(...where));
  return rows.length === 0;
}

/**
 * Shared precondition checks for both create and update: the unit/customer/
 * staff all belong to this workspace, and the date range is available.
 * `currentUnitId`/`currentStaffId` (update only) let a reservation keep a
 * since-deactivated unit or staff member unchanged; `excludeReservationId`
 * (update only) excludes the reservation's own row from the overlap check.
 */
async function validateReservationWrite(
  tx: Executor,
  workspaceId: string,
  input: ReservationInput,
  options: {
    currentUnitId?: string;
    currentStaffId?: string | null;
    excludeReservationId?: string;
  } = {},
): Promise<void> {
  const keepingCurrentUnit = options.currentUnitId === input.unitId;
  await assertUnitInWorkspace(tx, workspaceId, input.unitId, { requireActive: !keepingCurrentUnit });
  await assertCustomerInWorkspace(tx, workspaceId, input.customerId);

  if (input.staffId) {
    const keepingCurrentStaff = options.currentStaffId === input.staffId;
    await assertTeamMemberInWorkspace(tx, workspaceId, input.staffId, {
      requireActive: !keepingCurrentStaff,
    });
  }

  const available = await checkAvailability(
    tx,
    workspaceId,
    input.unitId,
    input.checkInDate,
    input.checkOutDate,
    options.excludeReservationId,
  );
  if (!available) throw new Error(OVERLAP_ERROR);
}

async function getRow(
  exec: Executor,
  workspaceId: string,
  id: string,
): Promise<ReservationListItem> {
  const rows = await baseQuery(exec).where(
    and(
      eq(reservations.id, id),
      eq(reservations.workspaceId, workspaceId),
      isNull(reservations.deletedAt),
    ),
  );
  const row = rows[0];
  if (!row) throw new Error("Reservation not found.");
  return toListItem(row);
}

export async function listReservations(
  workspaceId: string,
  actor: ReservationActor,
  filters: ReservationFilters,
): Promise<ReservationListItem[]> {
  const scope = await resolveScope(db, workspaceId, actor);
  if (scope.kind === "none") return [];

  const where = [
    eq(reservations.workspaceId, workspaceId),
    isNull(reservations.deletedAt),
  ];
  if (scope.kind === "assigned") {
    where.push(eq(reservations.staffId, scope.teamMemberId));
  }
  if (filters.status !== "all") where.push(eq(reservations.status, filters.status));
  if (filters.unitId !== "all") where.push(eq(reservations.unitId, filters.unitId));
  if (filters.staffId !== "all") where.push(eq(reservations.staffId, filters.staffId));
  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push(or(ilike(customers.name, term), ilike(rentalUnits.name, term))!);
  }

  const rows = await baseQuery(db)
    .where(and(...where))
    .orderBy(reservations.checkInDate);
  return rows.map(toListItem);
}

/**
 * Reservations overlapping `[rangeStart, rangeEnd)` — for the calendar view,
 * bounded to exactly the visible grid range (see `computeMonthGridRange`)
 * rather than the whole workspace history. Cancelled/no-show reservations are
 * excluded entirely: they never occupy a unit, so the calendar should never
 * render them as if they do.
 */
export async function listReservationsInRange(
  workspaceId: string,
  actor: ReservationActor,
  rangeStart: string,
  rangeEnd: string,
): Promise<ReservationListItem[]> {
  const scope = await resolveScope(db, workspaceId, actor);
  if (scope.kind === "none") return [];

  const where = [
    eq(reservations.workspaceId, workspaceId),
    isNull(reservations.deletedAt),
    notInArray(reservations.status, NON_BLOCKING_STATUSES),
    lt(reservations.checkInDate, rangeEnd),
    gt(reservations.checkOutDate, rangeStart),
  ];
  if (scope.kind === "assigned") where.push(eq(reservations.staffId, scope.teamMemberId));

  const rows = await baseQuery(db)
    .where(and(...where))
    .orderBy(reservations.checkInDate);
  return rows.map(toListItem);
}

export async function getReservation(
  workspaceId: string,
  id: string,
  actor: ReservationActor,
): Promise<ReservationListItem> {
  const row = await getRow(db, workspaceId, id);
  const actorTeamMemberId =
    actor.role === "owner" || actor.role === "manager"
      ? null
      : await resolveActorTeamMemberId(db, workspaceId, actor.userId);
  assertCanAccessReservation({
    role: actor.role,
    actorTeamMemberId: actorTeamMemberId ?? "",
    assignedStaffId: row.staffId,
  });
  return row;
}

/**
 * Reservations may only be *created* in a starting status (inquiry/pending/
 * confirmed) — reachable statuses like `checked_in` only exist by walking the
 * transition state machine from one of those, never as a starting point.
 */
export async function createReservation(
  workspaceId: string,
  input: ReservationInput,
  actor: ReservationActor,
): Promise<ReservationListItem> {
  assertManagerOrOwnerRole(actor.role);
  if (!isValidInitialStatus(input.status)) {
    throw new Error("Reservations can only be created as inquiry, pending, or confirmed.");
  }

  try {
    return await db.transaction(async (tx) => {
      await validateReservationWrite(tx, workspaceId, input);

      // Currency is stamped once at creation from the workspace's current
      // setting and never changes afterward (see updateReservation) — every
      // reservation in a workspace stays in one currency for as long as it
      // existed, so summing `priceCents` across them (revenue metrics) is safe.
      const { currency } = await getWorkspaceLocale(tx, workspaceId);

      const inserted = await tx
        .insert(reservations)
        .values({
          workspaceId,
          unitId: input.unitId,
          customerId: input.customerId,
          staffId: input.staffId ?? null,
          status: input.status,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          priceCents: Math.round(input.amount * 100),
          currency,
          source: input.source,
          notes: input.notes ?? null,
        })
        .returning({ id: reservations.id });

      return getRow(tx, workspaceId, inserted[0]!.id);
    });
  } catch (error) {
    if (isExclusionViolation(error)) throw new Error(OVERLAP_ERROR);
    throw error;
  }
}

/**
 * Full-field edit (unit/customer/staff/dates/price/notes and, optionally,
 * status). A status change is validated through the same state machine as
 * `updateReservationStatus` — this function must never let a terminal
 * reservation (`checked_out`/`cancelled`/`no_show`) be resurrected, nor allow
 * an otherwise-illegal transition, just because it arrived via the general
 * edit form instead of the dedicated status action.
 */
export async function updateReservation(
  workspaceId: string,
  id: string,
  input: ReservationInput,
  actor: ReservationActor,
): Promise<ReservationListItem> {
  assertManagerOrOwnerRole(actor.role);

  try {
    return await db.transaction(async (tx) => {
      const current = await tx
        .select({
          status: reservations.status,
          unitId: reservations.unitId,
          staffId: reservations.staffId,
        })
        .from(reservations)
        .where(
          and(
            eq(reservations.id, id),
            eq(reservations.workspaceId, workspaceId),
            isNull(reservations.deletedAt),
          ),
        );
      const currentRow = current[0];
      if (!currentRow) throw new Error("Reservation not found.");

      if (input.status !== currentRow.status) {
        assertStatusTransitionAllowed(
          actor.role,
          isValidReservationStatusTransition(currentRow.status, input.status),
          isEmployeeAllowedTransition(currentRow.status, input.status),
        );
      }

      await validateReservationWrite(tx, workspaceId, input, {
        currentUnitId: currentRow.unitId,
        currentStaffId: currentRow.staffId,
        excludeReservationId: id,
      });

      // Currency is intentionally not touched here — it's stamped once at
      // creation (see createReservation) and stays fixed for the
      // reservation's lifetime, so a routine edit can never silently drift
      // its currency even if the workspace's default currency changes later.
      await tx
        .update(reservations)
        .set({
          unitId: input.unitId,
          customerId: input.customerId,
          staffId: input.staffId ?? null,
          status: input.status,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          priceCents: Math.round(input.amount * 100),
          source: input.source,
          notes: input.notes ?? null,
        })
        .where(eq(reservations.id, id));

      return getRow(tx, workspaceId, id);
    });
  } catch (error) {
    if (isExclusionViolation(error)) throw new Error(OVERLAP_ERROR);
    throw error;
  }
}

/**
 * The employee-reachable path: status-only change, gated by the state
 * machine and (for employees) the narrower operational subset. Never
 * touches price/customer/unit/staff.
 */
export async function updateReservationStatus(
  workspaceId: string,
  id: string,
  nextStatus: ReservationStatusValue,
  actor: ReservationActor,
): Promise<ReservationListItem> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ status: reservations.status, staffId: reservations.staffId })
      .from(reservations)
      .where(
        and(
          eq(reservations.id, id),
          eq(reservations.workspaceId, workspaceId),
          isNull(reservations.deletedAt),
        ),
      );
    const row = rows[0];
    if (!row) throw new Error("Reservation not found.");

    const actorTeamMemberId =
      actor.role === "owner" || actor.role === "manager"
        ? null
        : await resolveActorTeamMemberId(tx, workspaceId, actor.userId);
    assertCanAccessReservation({
      role: actor.role,
      actorTeamMemberId: actorTeamMemberId ?? "",
      assignedStaffId: row.staffId,
    });

    assertStatusTransitionAllowed(
      actor.role,
      isValidReservationStatusTransition(row.status, nextStatus),
      isEmployeeAllowedTransition(row.status, nextStatus),
    );

    await tx
      .update(reservations)
      .set({ status: nextStatus })
      .where(eq(reservations.id, id));

    return getRow(tx, workspaceId, id);
  });
}

export async function softDeleteReservation(
  workspaceId: string,
  id: string,
  actor: ReservationActor,
): Promise<void> {
  assertManagerOrOwnerRole(actor.role);

  const rows = await db
    .update(reservations)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(reservations.id, id),
        eq(reservations.workspaceId, workspaceId),
        isNull(reservations.deletedAt),
      ),
    )
    .returning({ id: reservations.id });

  if (!rows[0]) throw new Error("Reservation not found.");
}

export async function listCustomerOptions(
  workspaceId: string,
): Promise<ReservationPersonOption[]> {
  return db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(and(eq(customers.workspaceId, workspaceId), isNull(customers.deletedAt)))
    .orderBy(customers.name);
}

export async function listStaffOptions(
  workspaceId: string,
): Promise<ReservationPersonOption[]> {
  const rows = await db
    .select({ id: teamMembers.id, fullName: users.fullName, email: users.email })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(
        eq(teamMembers.workspaceId, workspaceId),
        eq(teamMembers.status, "active"),
        isNull(teamMembers.deletedAt),
      ),
    );
  return rows
    .map((r) => ({ id: r.id, name: r.fullName?.trim() || r.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function rows<T>(exec: Executor, query: SQL): Promise<T[]> {
  const result = await exec.execute(query);
  return result as unknown as T[];
}

const n = (value: unknown): number => Number(value ?? 0);

/**
 * Owner/manager only — the sprint's RBAC brief doesn't grant employees
 * workspace-wide metrics visibility. Computed as a single grouped/filtered SQL
 * aggregate (not a full row fetch + JS loop), so this stays cheap regardless
 * of how much reservation history the workspace has accumulated. "Today" is
 * the workspace's own local calendar date, not the server's.
 */
export async function getReservationMetrics(
  workspaceId: string,
  actor: ReservationActor,
): Promise<ReservationMetrics> {
  assertManagerOrOwnerRole(actor.role);

  const [{ currency, timezone }, activeUnitCount] = await Promise.all([
    getWorkspaceLocale(db, workspaceId),
    countActiveRentalUnits(workspaceId),
  ]);
  const today = workspaceTodayDate(timezone);

  const [row] = await rows<{
    arrivalsToday: unknown;
    departuresToday: unknown;
    activeStays: unknown;
    activeStaysOnActiveUnits: unknown;
    confirmedUpcoming: unknown;
    cancelledCount: unknown;
    revenueCents: unknown;
  }>(
    db,
    sql`
      select
        count(*) filter (where check_in_date = ${today} and status in ('confirmed', 'checked_in')) as "arrivalsToday",
        count(*) filter (where check_out_date = ${today} and status in ('checked_in', 'checked_out')) as "departuresToday",
        count(*) filter (where status = 'checked_in') as "activeStays",
        -- Occupancy's numerator, specifically: a checked-in stay only counts
        -- toward "occupied" if its unit is still active today. Without this,
        -- a stay on a unit deactivated/soft-deleted after check-in would keep
        -- counting here while its unit drops out of activeUnitCount below,
        -- letting the ratio exceed 100%.
        count(*) filter (
          where status = 'checked_in'
            and unit_id in (${bookableRentalUnitIdsQuery(db, workspaceId)})
        ) as "activeStaysOnActiveUnits",
        count(*) filter (where status = 'confirmed' and check_in_date > ${today}) as "confirmedUpcoming",
        count(*) filter (where status = 'cancelled') as "cancelledCount",
        -- Restricted to the workspace's *current* currency: a reservation's own
        -- currency is stamped once at creation and never changes (see
        -- createReservation), but the workspace's currency setting itself can be
        -- changed later in Settings. Without this filter, a workspace that
        -- changes currency after accumulating reservations would silently sum
        -- old- and new-currency amounts under one (wrong) label. Occupancy
        -- figures (arrivals/departures/active stays) are currency-independent
        -- and deliberately NOT filtered — a stay still occupies a unit
        -- regardless of what currency it was priced in.
        coalesce(sum(price_cents) filter (where status in ('confirmed', 'checked_in', 'checked_out') and currency = ${currency}), 0) as "revenueCents"
      from reservations
      where workspace_id = ${workspaceId} and deleted_at is null
    `,
  );

  const activeStays = n(row?.activeStays);
  const activeStaysOnActiveUnits = n(row?.activeStaysOnActiveUnits);
  // Capped defensively at 100 in case a future edge case (or a race between
  // this query and the separate activeUnitCount count) ever produces a
  // numerator that briefly exceeds the denominator — occupancy is a
  // percentage of available inventory and should never display over 100%.
  const occupancyRatePercent =
    activeUnitCount > 0
      ? Math.min(100, Math.round((activeStaysOnActiveUnits / activeUnitCount) * 100))
      : 0;

  return {
    arrivalsToday: n(row?.arrivalsToday),
    departuresToday: n(row?.departuresToday),
    activeStays,
    confirmedUpcoming: n(row?.confirmedUpcoming),
    cancelledCount: n(row?.cancelledCount),
    revenueCents: n(row?.revenueCents),
    currency,
    occupancyRatePercent,
  };
}

function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === EXCLUSION_VIOLATION
  );
}
