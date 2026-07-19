import { and, eq, gt, isNull, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/db";
import type { Executor } from "../db/executor";
import { buildings, properties, rentalUnits, reservations, workspaces } from "../db/schema";
import { assertManagerOrOwnerRole, assertOwnerRole } from "../auth/rbac";
import {
  UNIT_DISPLAY_STATUSES,
  resolveUnitDisplayStatus,
  type RentalUnitFilters,
  type RentalUnitInput,
  type RentalUnitListItem,
  type RentalUnitOption,
  type UnitDisplayStatus,
} from "../validators/rental-unit";
import { NON_BLOCKING_STATUSES, workspaceTodayDate, type ReservationStatusValue } from "../validators/reservation";
import { assertPropertyInWorkspace } from "./property.service";
import { assertBuildingInProperty } from "./building.service";

/*
 * Rental units service — reusable data access for a workspace's bookable
 * inventory (rooms/apartments/villas), homed under a property and building
 * (Sprint 12). Every query is scoped to `workspaceId` and excludes
 * soft-deleted rows. Placement (which property/building a unit belongs to) is
 * immutable via the edit path — it's fixed by the route a unit is created
 * from and never re-validated on update (see `createRentalUnit` vs
 * `updateRentalUnit`). Create/edit is manager-or-owner; deleting is
 * owner-only. Listing is unrestricted — every role needs to see units to
 * file/view reservations.
 */

const RAW_COLUMNS = {
  id: rentalUnits.id,
  propertyId: rentalUnits.propertyId,
  propertyName: properties.name,
  buildingId: rentalUnits.buildingId,
  buildingName: buildings.name,
  name: rentalUnits.name,
  unitNumber: rentalUnits.unitNumber,
  floor: rentalUnits.floor,
  unitType: rentalUnits.unitType,
  description: rentalUnits.description,
  capacity: rentalUnits.capacity,
  bedrooms: rentalUnits.bedrooms,
  bathrooms: rentalUnits.bathrooms,
  sizeSqFt: rentalUnits.sizeSqFt,
  amenities: rentalUnits.amenities,
  notes: rentalUnits.notes,
  priceCents: rentalUnits.priceCents,
  currency: rentalUnits.currency,
  statusOverride: rentalUnits.statusOverride,
  createdAt: rentalUnits.createdAt,
};

function baseQuery(exec: Executor) {
  return exec
    .select(RAW_COLUMNS)
    .from(rentalUnits)
    .innerJoin(properties, eq(properties.id, rentalUnits.propertyId))
    .innerJoin(buildings, eq(buildings.id, rentalUnits.buildingId));
}

function toListItem(
  row: Awaited<ReturnType<typeof baseQuery>>[number],
  coveringReservationStatus: ReservationStatusValue | null,
): RentalUnitListItem {
  return {
    ...row,
    displayStatus: resolveUnitDisplayStatus({
      override: row.statusOverride,
      coveringReservationStatus,
    }),
  };
}

/**
 * `unitId`, when given, scopes the lookup to a single unit (used by
 * `getRentalUnit`); omitted, it covers every unit in the workspace (used by
 * `listRentalUnits`/`getPropertyManagementMetrics`). Only ever returns *at
 * most one* covering reservation per unit — the overlap-prevention EXCLUDE
 * constraint guarantees no two non-cancelled/no-show reservations for the
 * same unit can cover the same day.
 */
async function getCoveringReservationStatuses(
  exec: Executor,
  workspaceId: string,
  today: string,
  unitId?: string,
): Promise<Map<string, ReservationStatusValue>> {
  const where = [
    eq(reservations.workspaceId, workspaceId),
    isNull(reservations.deletedAt),
    notInArray(reservations.status, NON_BLOCKING_STATUSES),
    lte(reservations.checkInDate, today),
    gt(reservations.checkOutDate, today),
  ];
  if (unitId) where.push(eq(reservations.unitId, unitId));

  const rows = await exec
    .select({ unitId: reservations.unitId, status: reservations.status })
    .from(reservations)
    .where(and(...where));

  return new Map(rows.map((r) => [r.unitId, r.status]));
}

export async function listRentalUnits(
  workspaceId: string,
  filters: RentalUnitFilters = { status: "all", buildingId: "all" },
): Promise<RentalUnitListItem[]> {
  const { timezone } = await getWorkspaceLocale(db, workspaceId);
  const today = workspaceTodayDate(timezone);

  const where = [eq(rentalUnits.workspaceId, workspaceId), isNull(rentalUnits.deletedAt)];
  if (filters.buildingId !== "all") where.push(eq(rentalUnits.buildingId, filters.buildingId));

  const [rows, covering] = await Promise.all([
    baseQuery(db).where(and(...where)).orderBy(rentalUnits.name),
    getCoveringReservationStatuses(db, workspaceId, today),
  ]);

  const items = rows.map((row) => toListItem(row, covering.get(row.id) ?? null));
  if (filters.status === "all") return items;
  return items.filter((item) => item.displayStatus === filters.status);
}

/** Not soft-deleted and not flagged `out_of_service` — for the reservation form's unit selector. */
export async function listRentalUnitOptions(
  workspaceId: string,
): Promise<RentalUnitOption[]> {
  return db
    .select({
      id: rentalUnits.id,
      name: rentalUnits.name,
      priceCents: rentalUnits.priceCents,
      currency: rentalUnits.currency,
    })
    .from(rentalUnits)
    .where(
      and(
        eq(rentalUnits.workspaceId, workspaceId),
        isNull(rentalUnits.deletedAt),
        isUnitBookable(),
      ),
    )
    .orderBy(rentalUnits.name);
}

export async function getRentalUnit(
  workspaceId: string,
  id: string,
): Promise<RentalUnitListItem> {
  const { timezone } = await getWorkspaceLocale(db, workspaceId);
  const today = workspaceTodayDate(timezone);

  const rows = await baseQuery(db).where(
    and(eq(rentalUnits.id, id), eq(rentalUnits.workspaceId, workspaceId), isNull(rentalUnits.deletedAt)),
  );
  const row = rows[0];
  if (!row) throw new Error("Unit not found.");

  const covering = await getCoveringReservationStatuses(db, workspaceId, today, id);
  return toListItem(row, covering.get(id) ?? null);
}

/** Placement (property/building) is fixed at creation time from the route the unit was created from — always validated as active here, since there's no "keeping current" case for a brand-new unit. */
export async function createRentalUnit(
  workspaceId: string,
  propertyId: string,
  buildingId: string,
  input: RentalUnitInput,
  actor: { role: string },
): Promise<RentalUnitListItem> {
  assertManagerOrOwnerRole(actor.role);

  // The building check and the insert run inside one transaction, holding a
  // `FOR UPDATE` lock on the building row for its duration — a concurrent
  // `archiveBuilding` targeting the same building blocks until this
  // transaction commits, so a unit can never be inserted underneath a
  // building that's in the middle of being archived (mirrors
  // `building.service.ts`'s `createBuilding`). The property check doesn't
  // need the same lock: a property can only ever be archived once all its
  // buildings already are (`archiveProperty`'s own guard), so a building
  // that passes its own lock-protected check transitively guarantees the
  // property is fine too.
  const unitId = await db.transaction(async (tx) => {
    await assertPropertyInWorkspace(tx, workspaceId, propertyId);
    await assertBuildingInProperty(tx, workspaceId, propertyId, buildingId, { lock: true });

    // Currency is stamped once at creation from the workspace's current
    // setting (see updateRentalUnit — it never re-derives this on edit).
    const { currency } = await getWorkspaceLocale(tx, workspaceId);

    const rows = await tx
      .insert(rentalUnits)
      .values({
        workspaceId,
        propertyId,
        buildingId,
        name: input.name,
        unitNumber: input.unitNumber ?? null,
        floor: input.floor ?? null,
        unitType: input.unitType,
        description: input.description ?? null,
        capacity: input.capacity,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        sizeSqFt: input.sizeSqFt ?? null,
        amenities: input.amenities,
        notes: input.notes ?? null,
        priceCents: Math.round(input.amount * 100),
        currency,
        statusOverride: input.statusOverride ?? null,
      })
      .returning({ id: rentalUnits.id });

    return rows[0]!.id;
  });

  return getRentalUnit(workspaceId, unitId);
}

/** Placement (property/building) is immutable via this path — the edit form never offers to move a unit, so it's never re-validated here (see the module doc comment). */
export async function updateRentalUnit(
  workspaceId: string,
  id: string,
  input: RentalUnitInput,
  actor: { role: string },
): Promise<RentalUnitListItem> {
  assertManagerOrOwnerRole(actor.role);

  const rows = await db
    .update(rentalUnits)
    .set({
      name: input.name,
      unitNumber: input.unitNumber ?? null,
      floor: input.floor ?? null,
      unitType: input.unitType,
      description: input.description ?? null,
      capacity: input.capacity,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      sizeSqFt: input.sizeSqFt ?? null,
      amenities: input.amenities,
      notes: input.notes ?? null,
      priceCents: Math.round(input.amount * 100),
      // currency intentionally untouched — fixed at creation, see createRentalUnit.
      statusOverride: input.statusOverride ?? null,
    })
    .where(
      and(eq(rentalUnits.id, id), eq(rentalUnits.workspaceId, workspaceId), isNull(rentalUnits.deletedAt)),
    )
    .returning({ id: rentalUnits.id });

  if (!rows[0]) throw new Error("Unit not found.");
  return getRentalUnit(workspaceId, id);
}

/**
 * Soft delete: stamp `deleted_at` so the row (and its reservation history) is
 * retained but hidden and no longer selectable for new reservations.
 * Owner-only. Blocked while the unit has any reservation still in an open
 * lifecycle state (not yet checked out, cancelled, or a no-show) — Sprint 12
 * supersedes Sprint 11's more permissive behavior here (which allowed
 * deleting a unit with an active reservation, relying on the reservation
 * staying editable afterward); this sprint's spec explicitly requires the
 * guard instead.
 *
 * The reservation guard is a `NOT EXISTS` subquery inside the `UPDATE`'s own
 * `WHERE` clause (atomic, single statement) rather than a separate
 * SELECT-then-UPDATE pair, which would leave a race window where a
 * reservation created concurrently between the check and the delete would go
 * undetected — mirrors `property.service.ts`'s `archiveProperty`.
 */
export async function softDeleteRentalUnit(
  workspaceId: string,
  id: string,
  actor: { role: string },
): Promise<void> {
  assertOwnerRole(actor.role);

  const rows = await db
    .update(rentalUnits)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(rentalUnits.id, id),
        eq(rentalUnits.workspaceId, workspaceId),
        isNull(rentalUnits.deletedAt),
        sql`not exists (
          select 1 from ${reservations}
          where ${reservations.unitId} = ${rentalUnits.id}
            and ${reservations.deletedAt} is null
            and ${reservations.status} not in ('checked_out', 'cancelled', 'no_show')
        )`,
      ),
    )
    .returning({ id: rentalUnits.id });

  if (rows[0]) return;

  const existing = await db
    .select({ id: rentalUnits.id })
    .from(rentalUnits)
    .where(and(eq(rentalUnits.id, id), eq(rentalUnits.workspaceId, workspaceId), isNull(rentalUnits.deletedAt)));
  if (!existing[0]) throw new Error("Unit not found.");
  throw new Error("This unit has an active reservation and can't be removed.");
}

/** The workspace's own currency + timezone, read via the given executor (pass `tx` when called from inside a transaction, `db` otherwise). */
export async function getWorkspaceLocale(
  exec: Executor,
  workspaceId: string,
): Promise<{ currency: string; timezone: string }> {
  const rows = await exec
    .select({ currency: workspaces.currency, timezone: workspaces.timezone })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  return {
    currency: rows[0]?.currency ?? "USD",
    timezone: rows[0]?.timezone ?? "america-los_angeles",
  };
}

export async function getWorkspaceCurrency(
  exec: Executor,
  workspaceId: string,
): Promise<string> {
  return (await getWorkspaceLocale(exec, workspaceId)).currency;
}

/**
 * "Bookable" means "not soft-deleted and not flagged `out_of_service`"
 * (Sprint 11's `status = 'active'` toggle no longer exists — see
 * `rentalUnits`'s doc comment in `schema/tables.ts`). The single source of
 * truth for this predicate — every caller (this file's own
 * `listRentalUnitOptions`/`countActiveRentalUnits`,
 * `reservation.service.ts`'s `assertUnitInWorkspace`, and
 * `getReservationMetrics`'s occupancy subquery via
 * `bookableRentalUnitIdsQuery` below) composes it from here instead of
 * hand-writing the condition, so a future column rename can't silently
 * reintroduce the Sprint-12 regression where a raw SQL string kept
 * referencing a column this same migration had already dropped.
 */
export function isUnitBookable(): SQL {
  return or(isNull(rentalUnits.statusOverride), ne(rentalUnits.statusOverride, "out_of_service"))!;
}

/** Query builder (not yet executed) for the set of bookable unit ids in a workspace — lets a caller embed this as a subquery (e.g. via `sql` template interpolation) instead of duplicating the predicate in raw SQL. */
export function bookableRentalUnitIdsQuery(exec: Executor, workspaceId: string) {
  return exec
    .select({ id: rentalUnits.id })
    .from(rentalUnits)
    .where(and(eq(rentalUnits.workspaceId, workspaceId), isNull(rentalUnits.deletedAt), isUnitBookable()));
}

export async function countActiveRentalUnits(
  workspaceId: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rentalUnits)
    .where(
      and(
        eq(rentalUnits.workspaceId, workspaceId),
        isNull(rentalUnits.deletedAt),
        isUnitBookable(),
      ),
    );
  return rows[0]?.count ?? 0;
}

export interface PropertyManagementMetrics {
  propertyCount: number;
  buildingCount: number;
  unitCount: number;
  statusCounts: Record<UnitDisplayStatus, number>;
  occupancyRatePercent: number;
}

/**
 * Owner/manager/employee can all view this (Property Management's RBAC brief
 * is "Employee: read only", not "no access") — unlike Sprint 11's reservation
 * metrics, which are owner/manager-only. Computed from one grouped property/
 * building count query plus one per-unit covering-reservation pass, not a
 * per-property loop, so this stays cheap regardless of portfolio size.
 */
export async function getPropertyManagementMetrics(
  workspaceId: string,
): Promise<PropertyManagementMetrics> {
  const { timezone } = await getWorkspaceLocale(db, workspaceId);
  const today = workspaceTodayDate(timezone);

  const activePropertyWhere = and(
    eq(properties.workspaceId, workspaceId),
    isNull(properties.deletedAt),
    isNull(properties.archivedAt),
  );
  const activeBuildingWhere = and(
    eq(buildings.workspaceId, workspaceId),
    isNull(buildings.deletedAt),
    isNull(buildings.archivedAt),
  );

  const [propertyCountRows, buildingCountRows, units, covering] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(properties).where(activePropertyWhere),
    db.select({ count: sql<number>`count(*)::int` }).from(buildings).where(activeBuildingWhere),
    db
      .select({ id: rentalUnits.id, statusOverride: rentalUnits.statusOverride })
      .from(rentalUnits)
      .where(and(eq(rentalUnits.workspaceId, workspaceId), isNull(rentalUnits.deletedAt))),
    getCoveringReservationStatuses(db, workspaceId, today),
  ]);
  const propertyCount = propertyCountRows[0]?.count ?? 0;
  const buildingCount = buildingCountRows[0]?.count ?? 0;

  const statusCounts = Object.fromEntries(
    UNIT_DISPLAY_STATUSES.map((status) => [status, 0]),
  ) as Record<UnitDisplayStatus, number>;

  for (const unit of units) {
    const displayStatus = resolveUnitDisplayStatus({
      override: unit.statusOverride,
      coveringReservationStatus: covering.get(unit.id) ?? null,
    });
    statusCounts[displayStatus] += 1;
  }

  const bookableUnitCount = units.length - statusCounts.out_of_service;
  const occupancyRatePercent =
    bookableUnitCount > 0
      ? Math.min(100, Math.round((statusCounts.occupied / bookableUnitCount) * 100))
      : 0;

  return {
    propertyCount,
    buildingCount,
    unitCount: units.length,
    statusCounts,
    occupancyRatePercent,
  };
}
