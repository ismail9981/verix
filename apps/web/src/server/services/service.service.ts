import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { services } from "../db/schema";
import type {
  ServiceFilterStatus,
  ServiceInput,
  ServiceListItem,
} from "../validators/service";

/*
 * Services service — reusable data access for a workspace's bookable services.
 *
 * Every query is scoped to `workspaceId` and excludes soft-deleted rows
 * (`deleted_at is null`), so tenants can never read or mutate each other's
 * data and "deleted" services simply disappear. Price is stored in integer
 * cents; the dollar→cents conversion lives here at the domain boundary.
 */

const LIST_COLUMNS = {
  id: services.id,
  name: services.name,
  description: services.description,
  durationMinutes: services.durationMinutes,
  priceCents: services.priceCents,
  status: services.status,
};

export async function listServices(
  workspaceId: string,
  filters: { search?: string; status?: ServiceFilterStatus } = {},
): Promise<ServiceListItem[]> {
  const where = [
    eq(services.workspaceId, workspaceId),
    isNull(services.deletedAt),
  ];

  if (filters.status && filters.status !== "all") {
    where.push(eq(services.status, filters.status));
  }
  if (filters.search) {
    where.push(ilike(services.name, `%${filters.search}%`));
  }

  return db
    .select(LIST_COLUMNS)
    .from(services)
    .where(and(...where))
    .orderBy(desc(services.createdAt));
}

export async function createService(
  workspaceId: string,
  input: ServiceInput,
): Promise<ServiceListItem> {
  const rows = await db
    .insert(services)
    .values({
      workspaceId,
      name: input.name,
      description: input.description ?? null,
      durationMinutes: input.durationMinutes,
      priceCents: Math.round(input.price * 100),
      status: input.status,
    })
    .returning(LIST_COLUMNS);

  return rows[0]!;
}

export async function updateService(
  workspaceId: string,
  id: string,
  input: ServiceInput,
): Promise<ServiceListItem> {
  const rows = await db
    .update(services)
    .set({
      name: input.name,
      description: input.description ?? null,
      durationMinutes: input.durationMinutes,
      priceCents: Math.round(input.price * 100),
      status: input.status,
    })
    .where(
      and(
        eq(services.id, id),
        eq(services.workspaceId, workspaceId),
        isNull(services.deletedAt),
      ),
    )
    .returning(LIST_COLUMNS);

  const updated = rows[0];
  if (!updated) throw new Error("Service not found.");
  return updated;
}

/** Soft delete: stamp `deleted_at` so the row is retained but hidden. */
export async function softDeleteService(
  workspaceId: string,
  id: string,
): Promise<void> {
  const rows = await db
    .update(services)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(services.id, id),
        eq(services.workspaceId, workspaceId),
        isNull(services.deletedAt),
      ),
    )
    .returning({ id: services.id });

  if (!rows[0]) throw new Error("Service not found.");
}
