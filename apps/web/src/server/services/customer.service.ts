import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/db";
import { customers } from "../db/schema";
import type {
  CustomerFilterStatus,
  CustomerInput,
  CustomerListItem,
  CustomerStats,
} from "../validators/customer";

/*
 * Customers service — reusable data access for a workspace's CRM.
 *
 * Every query is scoped to `workspaceId` and excludes soft-deleted rows
 * (`deleted_at is null`), so tenants can never read or mutate each other's
 * customers and "deleted" customers simply disappear from the app.
 */

const LIST_COLUMNS = {
  id: customers.id,
  name: customers.name,
  email: customers.email,
  phone: customers.phone,
  status: customers.status,
  totalSpentCents: customers.totalSpentCents,
  notes: customers.notes,
  createdAt: customers.createdAt,
};

export async function listCustomers(
  workspaceId: string,
  filters: { search?: string; status?: CustomerFilterStatus } = {},
): Promise<CustomerListItem[]> {
  const where = [
    eq(customers.workspaceId, workspaceId),
    isNull(customers.deletedAt),
  ];

  if (filters.status && filters.status !== "all") {
    where.push(eq(customers.status, filters.status));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    // Search across name, email, and phone.
    where.push(
      or(
        ilike(customers.name, term),
        ilike(customers.email, term),
        ilike(customers.phone, term),
      )!,
    );
  }

  return db
    .select(LIST_COLUMNS)
    .from(customers)
    .where(and(...where))
    .orderBy(desc(customers.createdAt));
}

export async function getCustomerStats(
  workspaceId: string,
): Promise<CustomerStats> {
  const rows = await db
    .select({
      status: customers.status,
      count: sql<number>`count(*)::int`,
    })
    .from(customers)
    .where(and(eq(customers.workspaceId, workspaceId), isNull(customers.deletedAt)))
    .groupBy(customers.status);

  const counts = new Map(rows.map((r) => [r.status, r.count]));
  const active = counts.get("active") ?? 0;
  const created = counts.get("new") ?? 0;
  const vip = counts.get("vip") ?? 0;
  const inactive = counts.get("inactive") ?? 0;

  return {
    total: active + created + vip + inactive,
    active,
    new: created,
    vip,
  };
}

export async function createCustomer(
  workspaceId: string,
  input: CustomerInput,
): Promise<CustomerListItem> {
  const rows = await db
    .insert(customers)
    .values({
      workspaceId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      status: input.status,
      notes: input.notes ?? null,
    })
    .returning(LIST_COLUMNS);

  return rows[0]!;
}

export async function updateCustomer(
  workspaceId: string,
  id: string,
  input: CustomerInput,
): Promise<CustomerListItem> {
  const rows = await db
    .update(customers)
    .set({
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      status: input.status,
      notes: input.notes ?? null,
    })
    .where(
      and(
        eq(customers.id, id),
        eq(customers.workspaceId, workspaceId),
        isNull(customers.deletedAt),
      ),
    )
    .returning(LIST_COLUMNS);

  const updated = rows[0];
  if (!updated) throw new Error("Customer not found.");
  return updated;
}

/** Soft delete: stamp `deleted_at` so the row is retained but hidden. */
export async function softDeleteCustomer(
  workspaceId: string,
  id: string,
): Promise<void> {
  const rows = await db
    .update(customers)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(customers.id, id),
        eq(customers.workspaceId, workspaceId),
        isNull(customers.deletedAt),
      ),
    )
    .returning({ id: customers.id });

  if (!rows[0]) throw new Error("Customer not found.");
}
