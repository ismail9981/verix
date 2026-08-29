import { z } from "zod";
import { hasCapability } from "../auth/capabilities";
import { emptyToUndefined } from "./shared";
import type { PaymentMethodValue } from "./payment";
import type { PaymentType } from "./invoice";
import type { UnitDisplayStatus } from "./rental-unit";
import type {
  ReservationStatusValue,
  ReservationTodayItem,
  ReservationOperationsSnapshot,
} from "./reservation";

/*
 * Validation and pure presentation calculations for the live dashboard.
 * Calendar dates stay as `YYYY-MM-DD` strings all the way to the service
 * boundary. The service then interprets those dates in the workspace's stored
 * timezone, avoiding both server-local drift and ambiguous Date parsing.
 */

export const DASHBOARD_ANALYTICS_RANGES = [
  "today",
  "7d",
  "30d",
  "month",
  "custom",
] as const;
export type DashboardAnalyticsRange =
  (typeof DASHBOARD_ANALYTICS_RANGES)[number];

export const MAX_CUSTOM_RANGE_DAYS = 366;

const optionalDate = z.preprocess(emptyToUndefined, z.iso.date().optional());

function parseCalendarDate(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

export function addCalendarDays(value: string, days: number): string {
  const next = new Date(parseCalendarDate(value) + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

export function inclusiveCalendarDays(from: string, to: string): number {
  return (
    Math.floor((parseCalendarDate(to) - parseCalendarDate(from)) / 86_400_000) +
    1
  );
}

export const dashboardAnalyticsFiltersSchema = z
  .object({
    range: z.enum(DASHBOARD_ANALYTICS_RANGES),
    from: optionalDate,
    to: optionalDate,
  })
  .superRefine((value, ctx) => {
    if (value.range !== "custom") return;

    if (!value.from) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "Choose a start date.",
      });
    }
    if (!value.to) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "Choose an end date.",
      });
    }
    if (!value.from || !value.to) return;

    if (value.from > value.to) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "End date must be on or after the start date.",
      });
      return;
    }

    if (inclusiveCalendarDays(value.from, value.to) > MAX_CUSTOM_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `Custom ranges cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days.`,
      });
    }
  });

export type DashboardAnalyticsFilters = z.infer<
  typeof dashboardAnalyticsFiltersSchema
>;

export interface DashboardCalendarRange {
  startDate: string;
  /** Exclusive calendar-date boundary in the workspace timezone. */
  endDateExclusive: string;
}

export function resolveDashboardCalendarRange(
  filters: DashboardAnalyticsFilters,
  workspaceToday: string,
): DashboardCalendarRange {
  const endDateExclusive = addCalendarDays(workspaceToday, 1);
  switch (filters.range) {
    case "today":
      return { startDate: workspaceToday, endDateExclusive };
    case "7d":
      return {
        startDate: addCalendarDays(workspaceToday, -6),
        endDateExclusive,
      };
    case "month":
      return {
        startDate: `${workspaceToday.slice(0, 7)}-01`,
        endDateExclusive,
      };
    case "custom":
      // The schema guarantees both values and their ordering before this runs.
      return {
        startDate: filters.from!,
        endDateExclusive: addCalendarDays(filters.to!, 1),
      };
    case "30d":
      return {
        startDate: addCalendarDays(workspaceToday, -29),
        endDateExclusive,
      };
  }
}

export function dashboardAnalyticsQueryString(
  filters: DashboardAnalyticsFilters,
): string {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.range === "custom") {
    params.set("from", filters.from!);
    params.set("to", filters.to!);
  }
  return params.toString();
}

export function canViewDashboardFinancials(role: string): boolean {
  return hasCapability({ role }, "reports.financial.read");
}

export interface DashboardTrendPoint {
  label: string;
  value: number;
}

export interface RevenueSummary {
  totalCents: number;
  averagePaymentCents: number;
  currency: string;
  daily: DashboardTrendPoint[];
  weekly: DashboardTrendPoint[];
  monthly: DashboardTrendPoint[];
}

export interface DashboardPaymentAggregate {
  chargeCents: number;
  refundCents: number;
  chargeCount: number;
}

/** Voided rows are excluded by the service query before this pure calculation. */
export function summarizeDashboardPayments(input: DashboardPaymentAggregate): {
  netRevenueCents: number;
  averagePaymentCents: number;
} {
  return {
    netRevenueCents: input.chargeCents - input.refundCents,
    averagePaymentCents:
      input.chargeCount > 0
        ? Math.round(input.chargeCents / input.chargeCount)
        : 0,
  };
}

export interface OutstandingInvoiceRow {
  id: string;
  number: string;
  customerName: string | null;
  outstandingCents: number;
  currency: string;
}

export interface OutstandingInvoicesSummary {
  totalCents: number;
  currency: string;
  topInvoices: OutstandingInvoiceRow[];
}

export function buildOutstandingInvoicesSummary(
  invoices: OutstandingInvoiceRow[],
  totalCents: number,
  currency: string,
  limit: number,
): OutstandingInvoicesSummary {
  return {
    totalCents,
    currency,
    topInvoices: [...invoices]
      .filter((invoice) => invoice.outstandingCents > 0)
      .sort((a, b) => b.outstandingCents - a.outstandingCents)
      .slice(0, limit),
  };
}

export interface OccupancySummary {
  occupancyRatePercent: number;
  unitCount: number;
  statusCounts: Record<UnitDisplayStatus, number>;
}

/** All six segments and the displayed percentage use the same all-unit denominator. */
export function buildDashboardOccupancySummary(
  statusCounts: Record<UnitDisplayStatus, number>,
): OccupancySummary {
  const unitCount = Object.values(statusCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  return {
    occupancyRatePercent:
      unitCount > 0 ? Math.round((statusCounts.occupied / unitCount) * 100) : 0,
    unitCount,
    statusCounts: { ...statusCounts },
  };
}

export const ACTIVITY_EVENT_DOMAINS = ["billing", "reservations"] as const;
export type ActivityEventDomain = (typeof ACTIVITY_EVENT_DOMAINS)[number];

export type ActivityEventType =
  | "billing.payment_recorded"
  | "billing.refund_recorded"
  | "billing.payment_voided"
  | "reservations.created";

export interface ActivityEvent {
  id: string;
  domain: ActivityEventDomain;
  type: ActivityEventType;
  timestamp: Date;
  title: string;
  description?: string;
  amountCents?: number;
  currency?: string;
  href?: string;
}

export interface BillingActivitySource {
  id: string;
  type: PaymentType;
  amountCents: number;
  currency: string;
  method: PaymentMethodValue;
  paidAt: Date | null;
  voidedAt: Date | null;
  createdAt: Date;
}

export function billingPaymentToActivityEvent(
  payment: BillingActivitySource,
): ActivityEvent {
  const isVoided = payment.voidedAt !== null;
  const isRefund = payment.type === "refund";
  return {
    id: `payment-${payment.id}`,
    domain: "billing",
    type: isVoided
      ? "billing.payment_voided"
      : isRefund
        ? "billing.refund_recorded"
        : "billing.payment_recorded",
    timestamp: isVoided
      ? payment.voidedAt!
      : (payment.paidAt ?? payment.createdAt),
    title: isVoided
      ? "Payment voided"
      : isRefund
        ? "Refund recorded"
        : "Payment recorded",
    amountCents: payment.amountCents,
    currency: payment.currency,
    href: "/invoices",
  };
}

export function mergeDashboardActivity(
  sources: readonly ActivityEvent[][],
  limit: number,
): ActivityEvent[] {
  return sources
    .flat()
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

export interface DashboardAnalyticsKpis {
  revenueCollectedCents: number;
  outstandingCents: number;
  reservationsCount: number;
  occupancyRatePercent: number;
  averagePaymentCents: number;
  currency: string;
}

export interface DashboardAnalyticsData {
  canViewFinancials: boolean;
  kpis: DashboardAnalyticsKpis;
  revenue: RevenueSummary | null;
  reservationsPerDay: DashboardTrendPoint[];
  reservationSnapshot: ReservationOperationsSnapshot;
  todaysReservations: ReservationTodayItem[] | null;
  occupancy: OccupancySummary;
  outstandingInvoices: OutstandingInvoicesSummary | null;
  activity: ActivityEvent[] | null;
}

// Re-exported for dashboard UI consumers that should not need to know which
// domain validator owns these two non-financial reservation shapes.
export type {
  ReservationOperationsSnapshot,
  ReservationStatusValue,
  ReservationTodayItem,
};
