import {
  and,
  desc,
  eq,
  ilike,
  isNull,
  ne,
  sql,
  type ExtractTablesWithRelations,
} from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { db } from "../db/db";
import { bookings, customers, payments, services } from "../db/schema";
import {
  DUPLICATE_PAID_ERROR,
  type PaymentBookingOption,
  type PaymentFilterMethod,
  type PaymentFilterStatus,
  type PaymentInput,
  type PaymentListItem,
  type PaymentStats,
} from "../validators/payment";

/*
 * Payments service — reusable data access for a workspace's payments.
 *
 * Scoped to `workspaceId`, excludes soft-deleted rows. Money mutations run in a
 * transaction that (1) enforces one active "paid" payment per booking, (2)
 * recomputes the customer's lifetime spend, and (3) syncs the booking's payment
 * status — keeping derived financial fields consistent.
 */

// Any executor: the base db or a transaction (their common supertype).
type Schema = typeof import("../db/schema");
type Executor = PgDatabase<
  PostgresJsQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

const LIST_SELECT = {
  id: payments.id,
  bookingId: payments.bookingId,
  customerId: payments.customerId,
  customerName: sql<string>`coalesce(${customers.name}, '—')`,
  serviceName: services.name,
  amountCents: payments.amountCents,
  currency: payments.currency,
  method: payments.method,
  status: payments.status,
  paidAt: payments.paidAt,
  notes: payments.notes,
  createdAt: payments.createdAt,
};

function joinedQuery(exec: Executor) {
  return exec
    .select(LIST_SELECT)
    .from(payments)
    .leftJoin(customers, eq(payments.customerId, customers.id))
    .leftJoin(bookings, eq(payments.bookingId, bookings.id))
    .leftJoin(services, eq(bookings.serviceId, services.id));
}

export async function listPayments(
  workspaceId: string,
  filters: {
    search?: string;
    status?: PaymentFilterStatus;
    method?: PaymentFilterMethod;
  } = {},
): Promise<PaymentListItem[]> {
  const where = [
    eq(payments.workspaceId, workspaceId),
    isNull(payments.deletedAt),
  ];

  if (filters.status && filters.status !== "all") {
    where.push(eq(payments.status, filters.status));
  }
  if (filters.method && filters.method !== "all") {
    where.push(eq(payments.method, filters.method));
  }
  if (filters.search) {
    where.push(ilike(customers.name, `%${filters.search}%`));
  }

  return joinedQuery(db).where(and(...where)).orderBy(desc(payments.createdAt));
}

async function getPaymentById(
  exec: Executor,
  workspaceId: string,
  id: string,
): Promise<PaymentListItem> {
  const rows = await joinedQuery(exec).where(
    and(
      eq(payments.id, id),
      eq(payments.workspaceId, workspaceId),
      isNull(payments.deletedAt),
    ),
  );
  const row = rows[0];
  if (!row) throw new Error("Payment not found.");
  return row;
}

/** Load the booking (scoped) and return its customer id, or throw. */
async function getBookingCustomer(
  exec: Executor,
  workspaceId: string,
  bookingId: string,
): Promise<string> {
  const rows = await exec
    .select({ customerId: bookings.customerId })
    .from(bookings)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.workspaceId, workspaceId),
        isNull(bookings.deletedAt),
      ),
    );
  const row = rows[0];
  if (!row) throw new Error("Booking not found in workspace.");
  return row.customerId;
}

/** Recompute a customer's lifetime spend from their active, paid payments. */
async function recomputeCustomerTotal(
  exec: Executor,
  customerId: string,
): Promise<void> {
  await exec
    .update(customers)
    .set({
      totalSpentCents: sql<number>`(
        select coalesce(sum(${payments.amountCents}), 0)
        from ${payments}
        where ${payments.customerId} = ${customerId}
          and ${payments.status} = 'paid'
          and ${payments.deletedAt} is null
      )`,
    })
    .where(eq(customers.id, customerId));
}

/** Derive a booking's payment status from its active payments. */
async function syncBookingPaymentStatus(
  exec: Executor,
  bookingId: string,
): Promise<void> {
  const rows = await exec
    .select({ status: payments.status })
    .from(payments)
    .where(and(eq(payments.bookingId, bookingId), isNull(payments.deletedAt)));

  const statuses = new Set(rows.map((r) => r.status));
  const paymentStatus = statuses.has("paid")
    ? "paid"
    : statuses.has("refunded")
      ? "refunded"
      : "pending";

  await exec
    .update(bookings)
    .set({ paymentStatus })
    .where(eq(bookings.id, bookingId));
}

/** Guard against a second active "paid" payment for the same booking. */
async function assertNoDuplicatePaid(
  exec: Executor,
  bookingId: string,
  excludePaymentId?: string,
): Promise<void> {
  const where = [
    eq(payments.bookingId, bookingId),
    eq(payments.status, "paid"),
    isNull(payments.deletedAt),
  ];
  if (excludePaymentId) where.push(ne(payments.id, excludePaymentId));

  const existing = await exec
    .select({ id: payments.id })
    .from(payments)
    .where(and(...where));
  if (existing[0]) throw new Error(DUPLICATE_PAID_ERROR);
}

export async function createPayment(
  workspaceId: string,
  input: PaymentInput,
): Promise<PaymentListItem> {
  return db.transaction(async (tx) => {
    const customerId = await getBookingCustomer(tx, workspaceId, input.bookingId);

    if (input.status === "paid") {
      await assertNoDuplicatePaid(tx, input.bookingId);
    }

    const inserted = await tx
      .insert(payments)
      .values({
        workspaceId,
        customerId,
        bookingId: input.bookingId,
        amountCents: Math.round(input.amount * 100),
        currency: input.currency,
        method: input.method,
        status: input.status,
        paidAt: input.paidAt ?? (input.status === "paid" ? new Date() : null),
        notes: input.notes ?? null,
      })
      .returning({ id: payments.id });

    await recomputeCustomerTotal(tx, customerId);
    await syncBookingPaymentStatus(tx, input.bookingId);

    return getPaymentById(tx, workspaceId, inserted[0]!.id);
  });
}

export async function updatePayment(
  workspaceId: string,
  id: string,
  input: PaymentInput,
): Promise<PaymentListItem> {
  return db.transaction(async (tx) => {
    // The existing row tells us which customer/booking to also reconcile.
    const current = await tx
      .select({
        customerId: payments.customerId,
        bookingId: payments.bookingId,
      })
      .from(payments)
      .where(
        and(
          eq(payments.id, id),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.deletedAt),
        ),
      );
    const existing = current[0];
    if (!existing) throw new Error("Payment not found.");

    const customerId = await getBookingCustomer(tx, workspaceId, input.bookingId);

    if (input.status === "paid") {
      await assertNoDuplicatePaid(tx, input.bookingId, id);
    }

    await tx
      .update(payments)
      .set({
        customerId,
        bookingId: input.bookingId,
        amountCents: Math.round(input.amount * 100),
        currency: input.currency,
        method: input.method,
        status: input.status,
        paidAt: input.paidAt ?? (input.status === "paid" ? new Date() : null),
        notes: input.notes ?? null,
      })
      .where(and(eq(payments.id, id), eq(payments.workspaceId, workspaceId)));

    // Reconcile both the previous and the new customer/booking.
    const customerIds = new Set([customerId]);
    if (existing.customerId) customerIds.add(existing.customerId);
    for (const cid of customerIds) await recomputeCustomerTotal(tx, cid);

    const bookingIds = new Set([input.bookingId]);
    if (existing.bookingId) bookingIds.add(existing.bookingId);
    for (const bid of bookingIds) await syncBookingPaymentStatus(tx, bid);

    return getPaymentById(tx, workspaceId, id);
  });
}

/** Soft delete: stamp `deleted_at`, then reconcile the customer & booking. */
export async function softDeletePayment(
  workspaceId: string,
  id: string,
): Promise<void> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(payments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(payments.id, id),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.deletedAt),
        ),
      )
      .returning({
        customerId: payments.customerId,
        bookingId: payments.bookingId,
      });

    const removed = rows[0];
    if (!removed) throw new Error("Payment not found.");
    if (removed.customerId) await recomputeCustomerTotal(tx, removed.customerId);
    if (removed.bookingId) await syncBookingPaymentStatus(tx, removed.bookingId);
  });
}

export async function getPaymentStats(
  workspaceId: string,
): Promise<PaymentStats> {
  const scope = and(
    eq(payments.workspaceId, workspaceId),
    isNull(payments.deletedAt),
  );

  const grouped = await db
    .select({
      status: payments.status,
      count: sql<number>`count(*)::int`,
      sum: sql<string>`coalesce(sum(${payments.amountCents}), 0)`,
    })
    .from(payments)
    .where(scope)
    .groupBy(payments.status);

  const by = new Map(grouped.map((r) => [r.status, r]));
  const sumOf = (s: "paid" | "pending" | "refunded") =>
    Number(by.get(s)?.sum ?? 0);
  const countOf = (s: "paid" | "pending" | "refunded") =>
    by.get(s)?.count ?? 0;

  return {
    totalRevenueCents: sumOf("paid"),
    pendingRevenueCents: sumOf("pending"),
    refundedRevenueCents: sumOf("refunded"),
    paidCount: countOf("paid"),
    pendingCount: countOf("pending"),
    refundedCount: countOf("refunded"),
  };
}

export async function listBookingOptions(
  workspaceId: string,
): Promise<PaymentBookingOption[]> {
  return db
    .select({
      id: bookings.id,
      customerId: bookings.customerId,
      customerName: customers.name,
      serviceName: services.name,
      priceCents: bookings.priceCents,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(eq(bookings.workspaceId, workspaceId), isNull(bookings.deletedAt)))
    .orderBy(desc(bookings.createdAt));
}
