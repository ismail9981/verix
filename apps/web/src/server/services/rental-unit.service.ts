import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/db";
import type { Executor } from "../db/executor";
import { rentalUnits, workspaces } from "../db/schema";
import { assertOwnerRole } from "../auth/rbac";
import type {
  RentalUnitFilters,
  RentalUnitInput,
  RentalUnitListItem,
  RentalUnitOption,
} from "../validators/rental-unit";

/*
 * Rental units service — reusable data access for a workspace's bookable
 * inventory (rooms/apartments/villas). Every query is scoped to
 * `workspaceId` and excludes soft-deleted rows. Unit configuration
 * (create/update/delete) is owner-only per the sprint's RBAC brief; listing
 * is unrestricted (every role needs to see units to file/view reservations).
 */

const LIST_COLUMNS = {
  id: rentalUnits.id,
  name: rentalUnits.name,
  unitType: rentalUnits.unitType,
  description: rentalUnits.description,
  capacity: rentalUnits.capacity,
  priceCents: rentalUnits.priceCents,
  currency: rentalUnits.currency,
  status: rentalUnits.status,
  createdAt: rentalUnits.createdAt,
};

export async function listRentalUnits(
  workspaceId: string,
  filters: RentalUnitFilters = { status: "all" },
): Promise<RentalUnitListItem[]> {
  const where = [
    eq(rentalUnits.workspaceId, workspaceId),
    isNull(rentalUnits.deletedAt),
  ];
  if (filters.status !== "all") where.push(eq(rentalUnits.status, filters.status));

  return db
    .select(LIST_COLUMNS)
    .from(rentalUnits)
    .where(and(...where))
    .orderBy(rentalUnits.name);
}

/** Active, not-deleted units only — for the reservation form's unit selector. */
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
        eq(rentalUnits.status, "active"),
        isNull(rentalUnits.deletedAt),
      ),
    )
    .orderBy(rentalUnits.name);
}

export async function getRentalUnit(
  workspaceId: string,
  id: string,
): Promise<RentalUnitListItem> {
  const rows = await db
    .select(LIST_COLUMNS)
    .from(rentalUnits)
    .where(
      and(
        eq(rentalUnits.id, id),
        eq(rentalUnits.workspaceId, workspaceId),
        isNull(rentalUnits.deletedAt),
      ),
    );
  const row = rows[0];
  if (!row) throw new Error("Unit not found.");
  return row;
}

export async function createRentalUnit(
  workspaceId: string,
  input: RentalUnitInput,
  actor: { role: string },
): Promise<RentalUnitListItem> {
  assertOwnerRole(actor.role);

  // Currency is stamped once at creation from the workspace's current
  // setting (see updateRentalUnit — it never re-derives this on edit).
  const { currency } = await getWorkspaceLocale(db, workspaceId);

  const rows = await db
    .insert(rentalUnits)
    .values({
      workspaceId,
      name: input.name,
      unitType: input.unitType,
      description: input.description ?? null,
      capacity: input.capacity,
      priceCents: Math.round(input.amount * 100),
      currency,
      status: input.status,
    })
    .returning(LIST_COLUMNS);

  return rows[0]!;
}

export async function updateRentalUnit(
  workspaceId: string,
  id: string,
  input: RentalUnitInput,
  actor: { role: string },
): Promise<RentalUnitListItem> {
  assertOwnerRole(actor.role);

  const rows = await db
    .update(rentalUnits)
    .set({
      name: input.name,
      unitType: input.unitType,
      description: input.description ?? null,
      capacity: input.capacity,
      priceCents: Math.round(input.amount * 100),
      // currency intentionally untouched — fixed at creation, see createRentalUnit.
      status: input.status,
    })
    .where(
      and(
        eq(rentalUnits.id, id),
        eq(rentalUnits.workspaceId, workspaceId),
        isNull(rentalUnits.deletedAt),
      ),
    )
    .returning(LIST_COLUMNS);

  const updated = rows[0];
  if (!updated) throw new Error("Unit not found.");
  return updated;
}

/** Soft delete: stamp `deleted_at` so the row (and its reservation history) is retained but hidden and no longer selectable for new reservations. */
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
      ),
    )
    .returning({ id: rentalUnits.id });

  if (!rows[0]) throw new Error("Unit not found.");
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
    currency: rows[0]?.currency ?? "usd",
    timezone: rows[0]?.timezone ?? "america-los_angeles",
  };
}

export async function getWorkspaceCurrency(
  exec: Executor,
  workspaceId: string,
): Promise<string> {
  return (await getWorkspaceLocale(exec, workspaceId)).currency;
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
        eq(rentalUnits.status, "active"),
        isNull(rentalUnits.deletedAt),
      ),
    );
  return rows[0]?.count ?? 0;
}
