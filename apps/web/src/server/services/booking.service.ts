import { and, desc, eq, gte, ilike, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/db";
import { bookings, customers, services } from "../db/schema";
import { hasCapability, requireCapability } from "../auth/capabilities";
import type {
  BookingFilterStatus,
  BookingInput,
  BookingListItem,
  BookingOption,
  BookingStats,
} from "../validators/booking";

/*
 * Bookings service — reusable data access for a workspace's appointments.
 *
 * Every query is scoped to `workspaceId` and excludes soft-deleted rows.
 * Listing joins customers + services so the client gets display names without
 * extra round-trips. Create/update additionally verify that the referenced
 * customer and service belong to the same workspace (defense in depth: the
 * selectors only offer this tenant's rows, but the FKs are global).
 */

const LIST_SELECT = {
  id: bookings.id,
  customerId: bookings.customerId,
  customerName: customers.name,
  serviceId: bookings.serviceId,
  serviceName: services.name,
  status: bookings.status,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  notes: bookings.notes,
  createdAt: bookings.createdAt,
};

export interface BookingActor {
  readonly role: string;
  readonly membershipId: string;
}

function joinedQuery() {
  return db
    .select(LIST_SELECT)
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(services, eq(bookings.serviceId, services.id));
}

export async function listBookings(
  workspaceId: string,
  actor: BookingActor,
  filters: {
    search?: string;
    status?: BookingFilterStatus;
    service?: string;
  } = {},
): Promise<BookingListItem[]> {
  requireCapability(actor, "bookings.read");
  const where = [
    eq(bookings.workspaceId, workspaceId),
    isNull(bookings.deletedAt),
  ];
  if (!hasCapability(actor, "bookings.assign")) {
    where.push(eq(bookings.staffId, actor.membershipId));
  }

  if (filters.status && filters.status !== "all") {
    where.push(eq(bookings.status, filters.status));
  }
  if (filters.service && filters.service !== "all") {
    where.push(eq(bookings.serviceId, filters.service));
  }
  if (filters.search) {
    where.push(ilike(customers.name, `%${filters.search}%`));
  }

  return joinedQuery()
    .where(and(...where))
    .orderBy(desc(bookings.createdAt));
}

async function getBookingById(
  workspaceId: string,
  id: string,
): Promise<BookingListItem> {
  const rows = await joinedQuery().where(
    and(
      eq(bookings.id, id),
      eq(bookings.workspaceId, workspaceId),
      isNull(bookings.deletedAt),
    ),
  );
  const row = rows[0];
  if (!row) throw new Error("Booking not found.");
  return row;
}

async function assertRefsInWorkspace(
  workspaceId: string,
  customerId: string,
  serviceId: string,
): Promise<void> {
  const customer = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.workspaceId, workspaceId),
        isNull(customers.deletedAt),
      ),
    );
  if (!customer[0]) throw new Error("Customer not found in workspace.");

  const service = await db
    .select({ id: services.id })
    .from(services)
    .where(
      and(
        eq(services.id, serviceId),
        eq(services.workspaceId, workspaceId),
        isNull(services.deletedAt),
      ),
    );
  if (!service[0]) throw new Error("Service not found in workspace.");
}

export async function createBooking(
  workspaceId: string,
  actor: BookingActor,
  input: BookingInput,
): Promise<BookingListItem> {
  requireCapability(actor, "bookings.manage");
  await assertRefsInWorkspace(workspaceId, input.customerId, input.serviceId);

  const rows = await db
    .insert(bookings)
    .values({
      workspaceId,
      customerId: input.customerId,
      serviceId: input.serviceId,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      notes: input.notes ?? null,
    })
    .returning({ id: bookings.id });

  return getBookingById(workspaceId, rows[0]!.id);
}

export async function updateBooking(
  workspaceId: string,
  actor: BookingActor,
  id: string,
  input: BookingInput,
): Promise<BookingListItem> {
  requireCapability(actor, "bookings.manage");
  await assertRefsInWorkspace(workspaceId, input.customerId, input.serviceId);

  const rows = await db
    .update(bookings)
    .set({
      customerId: input.customerId,
      serviceId: input.serviceId,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      notes: input.notes ?? null,
    })
    .where(
      and(
        eq(bookings.id, id),
        eq(bookings.workspaceId, workspaceId),
        isNull(bookings.deletedAt),
      ),
    )
    .returning({ id: bookings.id });

  if (!rows[0]) throw new Error("Booking not found.");
  return getBookingById(workspaceId, id);
}

/** Soft delete: stamp `deleted_at` so the row is retained but hidden. */
export async function softDeleteBooking(
  workspaceId: string,
  actor: BookingActor,
  id: string,
): Promise<void> {
  requireCapability(actor, "bookings.manage");
  const rows = await db
    .update(bookings)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(bookings.id, id),
        eq(bookings.workspaceId, workspaceId),
        isNull(bookings.deletedAt),
      ),
    )
    .returning({ id: bookings.id });

  if (!rows[0]) throw new Error("Booking not found.");
}

export async function getBookingStats(
  workspaceId: string,
  actor: BookingActor,
): Promise<BookingStats> {
  requireCapability(actor, "bookings.read");
  const scope = and(
    eq(bookings.workspaceId, workspaceId),
    isNull(bookings.deletedAt),
    hasCapability(actor, "bookings.assign")
      ? undefined
      : eq(bookings.staffId, actor.membershipId),
  );

  const grouped = await db
    .select({ status: bookings.status, count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(scope)
    .groupBy(bookings.status);

  const counts = new Map(grouped.map((r) => [r.status, r.count]));
  const pending = counts.get("pending") ?? 0;
  const confirmed = counts.get("confirmed") ?? 0;
  const completed = counts.get("completed") ?? 0;
  const cancelled = counts.get("cancelled") ?? 0;

  // "Upcoming" = future appointments still pending or confirmed.
  const upcomingRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        scope,
        inArray(bookings.status, ["pending", "confirmed"]),
        gte(bookings.startsAt, new Date()),
      ),
    );

  return {
    total: pending + confirmed + completed + cancelled,
    upcoming: upcomingRows[0]?.count ?? 0,
    completed,
    cancelled,
  };
}

export async function listCustomerOptions(
  workspaceId: string,
  actor: BookingActor,
): Promise<BookingOption[]> {
  requireCapability(actor, "bookings.manage");
  return db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(
      and(eq(customers.workspaceId, workspaceId), isNull(customers.deletedAt)),
    )
    .orderBy(customers.name);
}

export async function listServiceOptions(
  workspaceId: string,
  actor: BookingActor,
): Promise<BookingOption[]> {
  requireCapability(actor, "bookings.manage");
  return db
    .select({ id: services.id, name: services.name })
    .from(services)
    .where(
      and(eq(services.workspaceId, workspaceId), isNull(services.deletedAt)),
    )
    .orderBy(services.name);
}
