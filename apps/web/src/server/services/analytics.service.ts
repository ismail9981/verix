import { sql, type SQL } from "drizzle-orm";
import { db } from "../db/db";
import type {
  AnalyticsData,
  AnalyticsFilters,
  AnalyticsPoint,
  RecentBookingRow,
  RecentPaymentRow,
  StatusCount,
  TopCustomerRow,
  TopServiceRow,
} from "../validators/analytics";

/*
 * Analytics service — every figure is computed with aggregate SQL, scoped to
 * the workspace and excluding soft-deleted rows, within the resolved date
 * window. Nothing loads full rows into the app: distributions/time-series use
 * GROUP BY (+ generate_series for zero-filled buckets) and the "recent"/"top"
 * lists are LIMITed. Bookings/customers are windowed by created_at; payments by
 * coalesce(paid_at, created_at) so revenue lands in the period it was received.
 */

interface Range {
  start: Date;
  end: Date;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function resolveRange(filters: AnalyticsFilters): Range {
  const now = new Date();

  switch (filters.range) {
    case "today":
      return { start: startOfDay(now), end: now };
    case "7d":
      return {
        start: startOfDay(new Date(now.getTime() - 6 * 86400000)),
        end: now,
      };
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    case "custom": {
      if (filters.from && filters.to && filters.from <= filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        return { start: startOfDay(filters.from), end };
      }
      // Fall through to the default window on an invalid custom range.
      return {
        start: startOfDay(new Date(now.getTime() - 29 * 86400000)),
        end: now,
      };
    }
    case "30d":
    default:
      return {
        start: startOfDay(new Date(now.getTime() - 29 * 86400000)),
        end: now,
      };
  }
}

async function rows<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result as unknown as T[];
}

const n = (value: unknown): number => Number(value ?? 0);

function toPoints(
  raw: { label: string; value: unknown }[],
): AnalyticsPoint[] {
  return raw.map((r) => ({ label: r.label, value: n(r.value) }));
}

/** Zero-filled revenue buckets (value in dollars) over [start, end). */
async function revenueSeries(
  workspaceId: string,
  { start, end }: Range,
  unit: "day" | "week" | "month",
  labelFormat: string,
): Promise<AnalyticsPoint[]> {
  const s = start.toISOString();
  const e = end.toISOString();
  const raw = await rows<{ label: string; value: unknown }>(sql`
    select to_char(g.bucket, ${labelFormat}) as "label",
           coalesce(sum(p.amount_cents), 0) as "value"
    from generate_series(
      date_trunc(${unit}, ${s}::timestamptz),
      ${e}::timestamptz,
      ('1 ' || ${unit})::interval
    ) as g(bucket)
    left join payments p
      on date_trunc(${unit}, coalesce(p.paid_at, p.created_at)) = g.bucket
     and p.workspace_id = ${workspaceId}
     and p.deleted_at is null
     and p.status = 'paid'
    group by g.bucket
    order by g.bucket
  `);
  return raw.map((r) => ({ label: r.label, value: n(r.value) / 100 }));
}

async function dailyCounts(
  workspaceId: string,
  { start, end }: Range,
  table: "bookings" | "customers",
): Promise<AnalyticsPoint[]> {
  const source =
    table === "bookings" ? sql`bookings` : sql`customers`;
  const s = start.toISOString();
  const e = end.toISOString();
  const raw = await rows<{ label: string; value: unknown }>(sql`
    select to_char(g.bucket, 'Mon DD') as "label", count(t.id) as "value"
    from generate_series(
      date_trunc('day', ${s}::timestamptz),
      ${e}::timestamptz,
      interval '1 day'
    ) as g(bucket)
    left join ${source} t
      on date_trunc('day', t.created_at) = g.bucket
     and t.workspace_id = ${workspaceId}
     and t.deleted_at is null
    group by g.bucket
    order by g.bucket
  `);
  return toPoints(raw);
}

export async function getAnalytics(
  workspaceId: string,
  filters: AnalyticsFilters,
): Promise<AnalyticsData> {
  const range = resolveRange(filters);
  const startIso = range.start.toISOString();
  const endIso = range.end.toISOString();

  const [
    paymentAgg,
    customerCount,
    bookingCount,
    activeServiceCount,
    daily,
    weekly,
    monthly,
    bookingStatus,
    bookingsPerDay,
    newCustomers,
    topServices,
    paymentMethods,
    paymentStatus,
    recentBookings,
    recentPayments,
    topCustomers,
  ] = await Promise.all([
    rows<{ revenue: unknown; paidCount: unknown; payers: unknown }>(sql`
      select coalesce(sum(amount_cents) filter (where status = 'paid'), 0) as "revenue",
             count(*) filter (where status = 'paid') as "paidCount",
             count(distinct customer_id) filter (where status = 'paid') as "payers"
      from payments
      where workspace_id = ${workspaceId} and deleted_at is null
        and coalesce(paid_at, created_at) >= ${startIso}::timestamptz
        and coalesce(paid_at, created_at) < ${endIso}::timestamptz
    `),
    rows<{ n: unknown }>(sql`
      select count(*) as "n" from customers
      where workspace_id = ${workspaceId} and deleted_at is null
        and created_at >= ${startIso}::timestamptz and created_at < ${endIso}::timestamptz
    `),
    rows<{ n: unknown }>(sql`
      select count(*) as "n" from bookings
      where workspace_id = ${workspaceId} and deleted_at is null
        and created_at >= ${startIso}::timestamptz and created_at < ${endIso}::timestamptz
    `),
    rows<{ n: unknown }>(sql`
      select count(*) as "n" from services
      where workspace_id = ${workspaceId} and deleted_at is null and status = 'active'
    `),
    revenueSeries(workspaceId, range, "day", "Mon DD"),
    revenueSeries(workspaceId, range, "week", "Mon DD"),
    revenueSeries(workspaceId, range, "month", "Mon YYYY"),
    rows<{ key: string; count: unknown }>(sql`
      select status as "key", count(*) as "count" from bookings
      where workspace_id = ${workspaceId} and deleted_at is null
        and created_at >= ${startIso}::timestamptz and created_at < ${endIso}::timestamptz
      group by status
    `),
    dailyCounts(workspaceId, range, "bookings"),
    dailyCounts(workspaceId, range, "customers"),
    rows<{
      id: string;
      name: string;
      bookings: unknown;
      revenue: unknown;
    }>(sql`
      select s.id as "id", s.name as "name",
             count(distinct b.id) as "bookings",
             coalesce(sum(p.amount_cents) filter (where p.status = 'paid'), 0) as "revenue"
      from bookings b
      join services s on s.id = b.service_id
      left join payments p on p.booking_id = b.id and p.deleted_at is null
      where b.workspace_id = ${workspaceId} and b.deleted_at is null
        and b.created_at >= ${startIso}::timestamptz and b.created_at < ${endIso}::timestamptz
      group by s.id, s.name
      order by "bookings" desc, "revenue" desc
      limit 6
    `),
    rows<{ key: string; count: unknown }>(sql`
      select method as "key", count(*) as "count" from payments
      where workspace_id = ${workspaceId} and deleted_at is null
        and coalesce(paid_at, created_at) >= ${startIso}::timestamptz
        and coalesce(paid_at, created_at) < ${endIso}::timestamptz
      group by method
    `),
    rows<{ key: string; count: unknown }>(sql`
      select status as "key", count(*) as "count" from payments
      where workspace_id = ${workspaceId} and deleted_at is null
        and coalesce(paid_at, created_at) >= ${startIso}::timestamptz
        and coalesce(paid_at, created_at) < ${endIso}::timestamptz
      group by status
    `),
    rows<RecentBookingRow>(sql`
      select b.id as "id", c.name as "customerName", s.name as "serviceName",
             b.starts_at as "startsAt", b.status as "status",
             b.price_cents as "amountCents"
      from bookings b
      join customers c on c.id = b.customer_id
      join services s on s.id = b.service_id
      where b.workspace_id = ${workspaceId} and b.deleted_at is null
        and b.created_at >= ${startIso}::timestamptz and b.created_at < ${endIso}::timestamptz
      order by b.created_at desc
      limit 8
    `),
    rows<RecentPaymentRow>(sql`
      select p.id as "id", coalesce(c.name, '—') as "customerName",
             p.method as "method", p.status as "status",
             p.amount_cents as "amountCents", p.currency as "currency",
             p.paid_at as "paidAt"
      from payments p
      left join customers c on c.id = p.customer_id
      where p.workspace_id = ${workspaceId} and p.deleted_at is null
        and coalesce(p.paid_at, p.created_at) >= ${startIso}::timestamptz
        and coalesce(p.paid_at, p.created_at) < ${endIso}::timestamptz
      order by p.created_at desc
      limit 8
    `),
    rows<{
      id: string;
      name: string;
      totalSpentCents: unknown;
      bookings: unknown;
    }>(sql`
      select c.id as "id", c.name as "name",
        (select coalesce(sum(p.amount_cents), 0) from payments p
          where p.customer_id = c.id and p.status = 'paid' and p.deleted_at is null
            and coalesce(p.paid_at, p.created_at) >= ${startIso}::timestamptz
            and coalesce(p.paid_at, p.created_at) < ${endIso}::timestamptz) as "totalSpentCents",
        (select count(*) from bookings b
          where b.customer_id = c.id and b.deleted_at is null
            and b.created_at >= ${startIso}::timestamptz and b.created_at < ${endIso}::timestamptz) as "bookings"
      from customers c
      where c.workspace_id = ${workspaceId} and c.deleted_at is null
      order by "totalSpentCents" desc, "bookings" desc
      limit 6
    `),
  ]);

  const revenue = n(paymentAgg[0]?.revenue);
  const paidCount = n(paymentAgg[0]?.paidCount);
  const payers = n(paymentAgg[0]?.payers);

  return {
    kpis: {
      totalRevenueCents: revenue,
      totalCustomers: n(customerCount[0]?.n),
      totalBookings: n(bookingCount[0]?.n),
      activeServices: n(activeServiceCount[0]?.n),
      avgBookingValueCents: paidCount ? Math.round(revenue / paidCount) : 0,
      avgCustomerSpendCents: payers ? Math.round(revenue / payers) : 0,
    },
    revenue: { daily, weekly, monthly },
    bookingStatus: bookingStatus.map(
      (r): StatusCount => ({ key: r.key, count: n(r.count) }),
    ),
    bookingsPerDay,
    newCustomers,
    topServices: topServices.map(
      (r): TopServiceRow => ({
        id: r.id,
        name: r.name,
        bookings: n(r.bookings),
        revenueCents: n(r.revenue),
      }),
    ),
    paymentMethods: paymentMethods.map(
      (r): StatusCount => ({ key: r.key, count: n(r.count) }),
    ),
    paymentStatus: paymentStatus.map(
      (r): StatusCount => ({ key: r.key, count: n(r.count) }),
    ),
    recentBookings: recentBookings.map((r) => ({
      ...r,
      amountCents: n(r.amountCents),
    })),
    recentPayments: recentPayments.map((r) => ({
      ...r,
      amountCents: n(r.amountCents),
    })),
    topCustomers: topCustomers.map(
      (r): TopCustomerRow => ({
        id: r.id,
        name: r.name,
        totalSpentCents: n(r.totalSpentCents),
        bookings: n(r.bookings),
      }),
    ),
  };
}
