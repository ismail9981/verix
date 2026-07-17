import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/db";
import type { Executor } from "../db/executor";
import { buildings, rentalUnits } from "../db/schema";
import { assertManagerOrOwnerRole, assertOwnerRole } from "../auth/rbac";
import { NotFoundError } from "./errors";
import {
  isValidBuildingReorder,
  nextBuildingPosition,
  type BuildingInput,
  type BuildingListItem,
  type BuildingOption,
} from "../validators/building";
import { assertPropertyInWorkspace } from "./property.service";

/*
 * Buildings service — the middle level of the property -> building ->
 * rental-unit hierarchy (Sprint 12). Every query is scoped to `workspaceId`
 * *and* `propertyId` — a building is always addressed through its parent
 * property, never by id alone, so a stray/foreign building id can never
 * resolve. Create/edit is manager-or-owner; archiving is owner-only.
 */

const LIST_COLUMNS = {
  id: buildings.id,
  propertyId: buildings.propertyId,
  name: buildings.name,
  position: buildings.position,
  archivedAt: buildings.archivedAt,
  createdAt: buildings.createdAt,
};

export async function listBuildings(
  workspaceId: string,
  propertyId: string,
): Promise<BuildingListItem[]> {
  const rows = await db
    .select({
      ...LIST_COLUMNS,
      unitCount: sql<number>`count(${rentalUnits.id}) filter (where ${rentalUnits.deletedAt} is null)::int`,
    })
    .from(buildings)
    .leftJoin(rentalUnits, eq(rentalUnits.buildingId, buildings.id))
    .where(
      and(
        eq(buildings.propertyId, propertyId),
        eq(buildings.workspaceId, workspaceId),
        isNull(buildings.deletedAt),
      ),
    )
    .groupBy(buildings.id)
    .orderBy(asc(buildings.position));

  return rows;
}

/** Non-archived, not-deleted buildings only — for the rental-unit form's building context. */
export async function listBuildingOptions(
  workspaceId: string,
  propertyId: string,
): Promise<BuildingOption[]> {
  return db
    .select({ id: buildings.id, name: buildings.name })
    .from(buildings)
    .where(
      and(
        eq(buildings.propertyId, propertyId),
        eq(buildings.workspaceId, workspaceId),
        isNull(buildings.deletedAt),
        isNull(buildings.archivedAt),
      ),
    )
    .orderBy(asc(buildings.position));
}

export async function getBuilding(
  workspaceId: string,
  propertyId: string,
  id: string,
): Promise<BuildingListItem> {
  const rows = await db
    .select({
      ...LIST_COLUMNS,
      unitCount: sql<number>`count(${rentalUnits.id}) filter (where ${rentalUnits.deletedAt} is null)::int`,
    })
    .from(buildings)
    .leftJoin(rentalUnits, eq(rentalUnits.buildingId, buildings.id))
    .where(
      and(
        eq(buildings.id, id),
        eq(buildings.propertyId, propertyId),
        eq(buildings.workspaceId, workspaceId),
        isNull(buildings.deletedAt),
      ),
    )
    .groupBy(buildings.id);

  const row = rows[0];
  if (!row) throw new NotFoundError("Building not found.");
  return row;
}

export async function createBuilding(
  workspaceId: string,
  propertyId: string,
  input: BuildingInput,
  actor: { role: string },
): Promise<BuildingListItem> {
  assertManagerOrOwnerRole(actor.role);

  // The whole check+insert runs inside one transaction, holding a `FOR
  // UPDATE` lock on the property row for its duration. This closes two
  // races at once: (1) a concurrent `archiveProperty` targeting the same
  // property blocks until this transaction commits, so a building can never
  // be inserted underneath a property that's in the middle of being
  // archived; (2) a concurrent `createBuilding` for the *same* property
  // also blocks on the same lock, so its own "existing positions" query only
  // runs after this insert has committed — it can never compute the same
  // `position` this call just used.
  const buildingId = await db.transaction(async (tx) => {
    await assertPropertyInWorkspace(tx, workspaceId, propertyId, { lock: true });

    const existing = await tx
      .select({ position: buildings.position })
      .from(buildings)
      .where(and(eq(buildings.propertyId, propertyId), isNull(buildings.deletedAt)));
    const position = nextBuildingPosition(existing.map((b) => b.position));

    const rows = await tx
      .insert(buildings)
      .values({ workspaceId, propertyId, name: input.name, position })
      .returning({ id: buildings.id });

    return rows[0]!.id;
  });

  return getBuilding(workspaceId, propertyId, buildingId);
}

export async function updateBuilding(
  workspaceId: string,
  propertyId: string,
  id: string,
  input: BuildingInput,
  actor: { role: string },
): Promise<BuildingListItem> {
  assertManagerOrOwnerRole(actor.role);

  const rows = await db
    .update(buildings)
    .set({ name: input.name })
    .where(
      and(
        eq(buildings.id, id),
        eq(buildings.propertyId, propertyId),
        eq(buildings.workspaceId, workspaceId),
        isNull(buildings.deletedAt),
      ),
    )
    .returning({ id: buildings.id });

  if (!rows[0]) throw new Error("Building not found.");
  return getBuilding(workspaceId, propertyId, id);
}

/**
 * Manager-or-owner. Persists a full new ordering for a property's buildings
 * in one transaction. `orderedIds` must be an exact permutation of the
 * property's current (non-deleted) building ids — validated with
 * `isValidBuildingReorder` before any write, mirroring
 * `crm-pipeline.service.ts`'s `reorderPipelineStages` — a partial, foreign,
 * or stale id list is rejected outright instead of silently updating only
 * the ids that happen to match and leaving the rest at whatever position
 * they already had (which could collide with a newly-assigned position).
 */
export async function reorderBuildings(
  workspaceId: string,
  propertyId: string,
  orderedIds: string[],
  actor: { role: string },
): Promise<void> {
  assertManagerOrOwnerRole(actor.role);

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: buildings.id })
      .from(buildings)
      .where(
        and(
          eq(buildings.propertyId, propertyId),
          eq(buildings.workspaceId, workspaceId),
          isNull(buildings.deletedAt),
        ),
      );
    if (!isValidBuildingReorder(existing.map((b) => b.id), orderedIds)) {
      throw new Error("Reorder must include exactly this property's current buildings.");
    }

    await Promise.all(
      orderedIds.map((id, position) =>
        tx
          .update(buildings)
          .set({ position })
          .where(
            and(
              eq(buildings.id, id),
              eq(buildings.propertyId, propertyId),
              eq(buildings.workspaceId, workspaceId),
              isNull(buildings.deletedAt),
            ),
          ),
      ),
    );
  });
}

/**
 * Owner-only. Blocked while the building has any non-deleted rental unit —
 * the hierarchy must be torn down top-down, one explicit step at a time.
 *
 * The unit guard is a `NOT EXISTS` subquery inside the `UPDATE`'s own `WHERE`
 * clause (atomic, single statement) rather than a separate SELECT-then-UPDATE
 * pair, which would leave a race window where a unit created concurrently
 * between the check and the archive would go undetected — mirrors
 * `property.service.ts`'s `archiveProperty`.
 */
export async function archiveBuilding(
  workspaceId: string,
  propertyId: string,
  id: string,
  actor: { role: string },
): Promise<void> {
  assertOwnerRole(actor.role);

  const rows = await db
    .update(buildings)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(buildings.id, id),
        eq(buildings.propertyId, propertyId),
        eq(buildings.workspaceId, workspaceId),
        isNull(buildings.deletedAt),
        isNull(buildings.archivedAt),
        sql`not exists (
          select 1 from ${rentalUnits}
          where ${rentalUnits.buildingId} = ${buildings.id}
            and ${rentalUnits.deletedAt} is null
        )`,
      ),
    )
    .returning({ id: buildings.id });

  if (rows[0]) return;

  const existing = await db
    .select({ archivedAt: buildings.archivedAt })
    .from(buildings)
    .where(
      and(
        eq(buildings.id, id),
        eq(buildings.propertyId, propertyId),
        eq(buildings.workspaceId, workspaceId),
        isNull(buildings.deletedAt),
      ),
    );
  if (!existing[0]) throw new Error("Building not found.");
  if (existing[0].archivedAt) throw new Error("Building is already archived.");
  throw new Error("Remove this building's rental units first.");
}

/**
 * Placement (which property/building a unit belongs to) is fixed at creation
 * and never re-validated on edit (mirrors `assertPropertyInWorkspace`'s
 * reasoning — see `property.service.ts`), so this only ever needs to check
 * "is this building active."
 */
export async function assertBuildingInProperty(
  exec: Executor,
  workspaceId: string,
  propertyId: string,
  buildingId: string,
  options: { lock?: boolean } = {},
): Promise<void> {
  let query = exec
    .select({ id: buildings.id })
    .from(buildings)
    .where(
      and(
        eq(buildings.id, buildingId),
        eq(buildings.propertyId, propertyId),
        eq(buildings.workspaceId, workspaceId),
        isNull(buildings.deletedAt),
        isNull(buildings.archivedAt),
      ),
    );
  // `lock: true` takes a row-level `FOR UPDATE` lock — only meaningful (and
  // only ever passed) when `exec` is a transaction's `tx`: it makes a
  // concurrent `archiveBuilding` targeting the same row block until this
  // transaction commits or rolls back, closing the race where a unit could
  // otherwise be created in the narrow window between this check and the
  // insert that follows it (see `rental-unit.service.ts`'s `createRentalUnit`).
  if (options.lock) query = query.for("update") as typeof query;
  const rows = await query;
  if (!rows[0]) throw new Error("Building not found in this property, or archived.");
}
