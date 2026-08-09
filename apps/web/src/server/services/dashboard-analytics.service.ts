import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/db";
import { customers, reservations } from "../db/schema";
import { logger } from "../observability/logger";
import { n, rows } from "./sql-helpers";
import { getPropertyManagementMetrics, getWorkspaceLocale } from "./rental-unit.service";
import {
  getReservationOperationsSnapshot,
  listTodaysReservations,
  resolveScope,
} from "./reservation.service";
import {
  getOutstandingInvoicesSummary,
  getRevenueSummary,
  listRecentInvoicePayments,
} from "./invoice.service";
import { toIanaTimezone, workspaceTodayDate, type ReservationScope } from "../validators/reservation";
import {
  billingPaymentToActivityEvent,
  buildDashboardOccupancySummary,
  canViewDashboardFinancials,
  mergeDashboardActivity,
  resolveDashboardCalendarRange,
  type ActivityEvent,
  type DashboardAnalyticsData,
  type DashboardAnalyticsFilters,
  type DashboardCalendarRange,
  type DashboardTrendPoint,
} from "../validators/dashboard-analytics";

/*
 * Dashboard analytics orchestration. Calendar boundaries are resolved once
 * from the workspace timezone; locale and employee reservation scope are also
 * resolved once and passed through to the domain queries that need them.
 */

async function reservationsPerDay(
  workspaceId: string,
  scope: ReservationScope,
  range: DashboardCalendarRange,
  timeZone: string,
): Promise<DashboardTrendPoint[]> {
  if (scope.kind === "none") return [];
  const scopeFilter =
    scope.kind === "assigned" ? sql`and r.staff_id = ${scope.teamMemberId}` : sql``;
  const raw = await rows<{ label: string; value: unknown }>(
    db,
    sql`
      select to_char(g.bucket, 'Mon DD') as "label", count(r.id) as "value"
      from generate_series(
        ${range.startDate}::timestamp,
        (${range.endDateExclusive}::date - interval '1 day')::timestamp,
        interval '1 day'
      ) as g(bucket)
      left join reservations r
        on (r.created_at at time zone ${timeZone})::date = g.bucket::date
       and r.workspace_id = ${workspaceId}
       and r.deleted_at is null
       and r.created_at >= (${range.startDate}::date at time zone ${timeZone})
       and r.created_at < (${range.endDateExclusive}::date at time zone ${timeZone})
       ${scopeFilter}
      group by g.bucket
      order by g.bucket
    `,
  );
  return raw.map((row) => ({ label: row.label, value: n(row.value) }));
}

async function recentReservationEvents(
  workspaceId: string,
  scope: ReservationScope,
  limit: number,
): Promise<ActivityEvent[]> {
  if (scope.kind === "none") return [];
  const where = [eq(reservations.workspaceId, workspaceId), isNull(reservations.deletedAt)];
  if (scope.kind === "assigned") where.push(eq(reservations.staffId, scope.teamMemberId));

  const found = await db
    .select({
      id: reservations.id,
      customerName: customers.name,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
      createdAt: reservations.createdAt,
    })
    .from(reservations)
    .innerJoin(customers, eq(customers.id, reservations.customerId))
    .where(and(...where))
    .orderBy(desc(reservations.createdAt))
    .limit(limit);

  return found.map((row) => ({
    id: `reservation-${row.id}`,
    domain: "reservations",
    type: "reservations.created",
    timestamp: row.createdAt,
    title: `New reservation — ${row.customerName}`,
    description: `${row.checkInDate} → ${row.checkOutDate}`,
    href: "/reservations",
  }));
}

async function optionalWidget<T>(
  name: string,
  workspaceId: string,
  load: Promise<T>,
): Promise<T | null> {
  try {
    return await load;
  } catch (error) {
    logger.error("dashboard.optional_widget_failed", { name, workspaceId, err: error });
    return null;
  }
}

const ACTIVITY_LIMIT = 12;

export async function getDashboardAnalytics(
  workspaceId: string,
  actor: { userId: string; role: string },
  filters: DashboardAnalyticsFilters,
): Promise<DashboardAnalyticsData> {
  const canViewFinancials = canViewDashboardFinancials(actor.role);
  const locale = await getWorkspaceLocale(db, workspaceId);
  const timeZone = toIanaTimezone(locale.timezone);
  const today = workspaceTodayDate(locale.timezone);
  const calendarRange = resolveDashboardCalendarRange(filters, today);
  const range = { ...calendarRange, timeZone };
  const reservationScope = await resolveScope(db, workspaceId, actor);

  const [
    revenue,
    outstandingInvoices,
    reservationSnapshot,
    occupancyMetrics,
    reservationsPerDayPoints,
    recentPayments,
    recentReservations,
    todaysReservations,
  ] = await Promise.all([
    canViewFinancials
      ? getRevenueSummary(workspaceId, actor, range, locale.currency)
      : Promise.resolve(null),
    canViewFinancials
      ? getOutstandingInvoicesSummary(workspaceId, actor, locale.currency)
      : Promise.resolve(null),
    getReservationOperationsSnapshot(workspaceId, actor, today, reservationScope),
    getPropertyManagementMetrics(workspaceId, locale),
    reservationsPerDay(workspaceId, reservationScope, calendarRange, timeZone),
    canViewFinancials
      ? optionalWidget(
          "recent-payments",
          workspaceId,
          listRecentInvoicePayments(workspaceId, actor, ACTIVITY_LIMIT),
        )
      : Promise.resolve([]),
    optionalWidget(
      "recent-reservations",
      workspaceId,
      recentReservationEvents(workspaceId, reservationScope, ACTIVITY_LIMIT),
    ),
    optionalWidget(
      "todays-reservations",
      workspaceId,
      listTodaysReservations(workspaceId, actor, today, 8, reservationScope),
    ),
  ]);

  const reservationsCount = reservationsPerDayPoints.reduce(
    (sum, point) => sum + point.value,
    0,
  );
  const occupancy = buildDashboardOccupancySummary(occupancyMetrics.statusCounts);
  const activity =
    recentPayments === null || recentReservations === null
      ? null
      : mergeDashboardActivity(
          [recentPayments.map(billingPaymentToActivityEvent), recentReservations],
          ACTIVITY_LIMIT,
        );

  return {
    canViewFinancials,
    kpis: {
      revenueCollectedCents: revenue?.totalCents ?? 0,
      outstandingCents: outstandingInvoices?.totalCents ?? 0,
      reservationsCount,
      occupancyRatePercent: occupancy.occupancyRatePercent,
      averagePaymentCents: revenue?.averagePaymentCents ?? 0,
      currency: locale.currency,
    },
    revenue,
    reservationsPerDay: reservationsPerDayPoints,
    reservationSnapshot,
    todaysReservations,
    occupancy,
    outstandingInvoices,
    activity,
  };
}
