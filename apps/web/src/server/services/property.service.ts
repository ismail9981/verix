import { and, eq, ilike, isNull, sql } from "drizzle-orm";
import { db } from "../db/db";
import type { Executor } from "../db/executor";
import { buildings, properties, rentalUnits } from "../db/schema";
import { requireCapability } from "../auth/capabilities";
import { NotFoundError } from "./errors";
import type {
  PropertyFilters,
  PropertyInput,
  PropertyListItem,
  PropertyOption,
} from "../validators/property";

/*
 * Properties service — the top level of the property -> building ->
 * rental-unit hierarchy (Sprint 12). Every query is scoped to `workspaceId`
 * and excludes soft-deleted rows. Create/edit is manager-or-owner; archiving
 * is owner-only (mirrors the sprint's RBAC brief). Listing is unrestricted —
 * every role needs to see properties to navigate to their buildings/units.
 */

const LIST_COLUMNS = {
  id: properties.id,
  name: properties.name,
  addressLine1: properties.addressLine1,
  addressLine2: properties.addressLine2,
  city: properties.city,
  state: properties.state,
  postalCode: properties.postalCode,
  country: properties.country,
  description: properties.description,
  archivedAt: properties.archivedAt,
  createdAt: properties.createdAt,
};

function baseListQuery(exec: Executor) {
  return exec
    .select({
      ...LIST_COLUMNS,
      buildingCount: sql<number>`count(distinct ${buildings.id}) filter (where ${buildings.deletedAt} is null)::int`,
      unitCount: sql<number>`count(distinct ${rentalUnits.id}) filter (where ${rentalUnits.deletedAt} is null)::int`,
    })
    .from(properties)
    .leftJoin(buildings, eq(buildings.propertyId, properties.id))
    .leftJoin(rentalUnits, eq(rentalUnits.propertyId, properties.id))
    .groupBy(properties.id);
}

export async function listProperties(
  workspaceId: string,
  filters: PropertyFilters = { search: "" },
): Promise<PropertyListItem[]> {
  const where = [
    eq(properties.workspaceId, workspaceId),
    isNull(properties.deletedAt),
  ];
  if (filters.search) where.push(ilike(properties.name, `%${filters.search}%`));

  return baseListQuery(db)
    .where(and(...where))
    .orderBy(properties.name);
}

/** Non-archived, not-deleted properties only — for a building's property context and other selectors. */
export async function listPropertyOptions(
  workspaceId: string,
): Promise<PropertyOption[]> {
  return db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(
      and(
        eq(properties.workspaceId, workspaceId),
        isNull(properties.deletedAt),
        isNull(properties.archivedAt),
      ),
    )
    .orderBy(properties.name);
}

export async function getProperty(
  workspaceId: string,
  id: string,
): Promise<PropertyListItem> {
  const rows = await baseListQuery(db).where(
    and(
      eq(properties.id, id),
      eq(properties.workspaceId, workspaceId),
      isNull(properties.deletedAt),
    ),
  );
  const row = rows[0];
  if (!row) throw new NotFoundError("Property not found.");
  return row;
}

export async function createProperty(
  workspaceId: string,
  input: PropertyInput,
  actor: { role: string },
): Promise<PropertyListItem> {
  requireCapability(actor, "properties.manage");

  const rows = await db
    .insert(properties)
    .values({
      workspaceId,
      name: input.name,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null,
      description: input.description ?? null,
    })
    .returning({ id: properties.id });

  return getProperty(workspaceId, rows[0]!.id);
}

export async function updateProperty(
  workspaceId: string,
  id: string,
  input: PropertyInput,
  actor: { role: string },
): Promise<PropertyListItem> {
  requireCapability(actor, "properties.manage");

  const rows = await db
    .update(properties)
    .set({
      name: input.name,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null,
      description: input.description ?? null,
    })
    .where(
      and(
        eq(properties.id, id),
        eq(properties.workspaceId, workspaceId),
        isNull(properties.deletedAt),
      ),
    )
    .returning({ id: properties.id });

  if (!rows[0]) throw new Error("Property not found.");
  return getProperty(workspaceId, id);
}

/**
 * Owner-only. Blocked while the property has any non-archived building — the
 * hierarchy must be torn down top-down, one explicit step at a time, rather
 * than an archive silently orphaning (or worse, hiding) buildings/units still
 * in use underneath it.
 *
 * The building guard is expressed as a `NOT EXISTS` subquery inside the
 * `UPDATE`'s own `WHERE` clause — evaluated atomically as part of one
 * statement — rather than a separate SELECT-then-UPDATE pair of round-trips,
 * which would leave a race window where a building inserted concurrently
 * between the check and the archive would go undetected.
 */
export async function archiveProperty(
  workspaceId: string,
  id: string,
  actor: { role: string },
): Promise<void> {
  requireCapability(actor, "properties.archive");

  const rows = await db
    .update(properties)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(properties.id, id),
        eq(properties.workspaceId, workspaceId),
        isNull(properties.deletedAt),
        isNull(properties.archivedAt),
        sql`not exists (
          select 1 from ${buildings}
          where ${buildings.propertyId} = ${properties.id}
            and ${buildings.deletedAt} is null
            and ${buildings.archivedAt} is null
        )`,
      ),
    )
    .returning({ id: properties.id });

  if (rows[0]) return;

  // The atomic update above affected no rows — figure out why, for a specific error.
  const existing = await db
    .select({ archivedAt: properties.archivedAt })
    .from(properties)
    .where(
      and(
        eq(properties.id, id),
        eq(properties.workspaceId, workspaceId),
        isNull(properties.deletedAt),
      ),
    );
  if (!existing[0]) throw new Error("Property not found.");
  if (existing[0].archivedAt) throw new Error("Property is already archived.");
  throw new Error("Archive or remove this property's buildings first.");
}

/**
 * Placement (which property/building a unit belongs to) is fixed at creation
 * and never re-validated on edit (the edit form never offers to move a unit
 * — see `rental-unit.service.ts`'s module doc comment), so this only ever
 * needs to check "is this property active," never a "keep the current one
 * even if archived" exception.
 */
export async function assertPropertyInWorkspace(
  exec: Executor,
  workspaceId: string,
  propertyId: string,
  options: { lock?: boolean } = {},
): Promise<void> {
  let query = exec
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        eq(properties.id, propertyId),
        eq(properties.workspaceId, workspaceId),
        isNull(properties.deletedAt),
        isNull(properties.archivedAt),
      ),
    );
  // `lock: true` takes a row-level `FOR UPDATE` lock — only meaningful (and
  // only ever passed) when `exec` is a transaction's `tx`: it makes a
  // concurrent `archiveProperty` targeting the same row block until this
  // transaction commits or rolls back, closing the race where a building
  // could otherwise be created in the narrow window between this check and
  // the insert that follows it (see `building.service.ts`'s `createBuilding`).
  if (options.lock) query = query.for("update") as typeof query;
  const rows = await query;
  if (!rows[0]) throw new Error("Property not found or archived.");
}
