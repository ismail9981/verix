import { z } from "zod";
import { emptyToUndefined } from "./shared";

/*
 * Validation + shared types for the Analytics dashboard.
 *
 * The dashboard is read-only: the only "input" is the global date filter,
 * parsed from URL search params. `analyticsFiltersSchema` normalizes the range
 * preset and the optional custom `from`/`to` bounds. All figures are computed
 * server-side with aggregate SQL and returned as this `AnalyticsData` bundle.
 */

export const ANALYTICS_RANGES = [
  "today",
  "7d",
  "30d",
  "month",
  "custom",
] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const analyticsFiltersSchema = z.object({
  range: z.enum(ANALYTICS_RANGES).catch("30d"),
  from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});

export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;

/** A single point on a time-series/bar chart. */
export interface AnalyticsPoint {
  label: string;
  value: number;
}

/** A raw enum-keyed count for a distribution chart. */
export interface StatusCount {
  key: string;
  count: number;
}

export interface AnalyticsKpis {
  totalRevenueCents: number;
  totalCustomers: number;
  totalBookings: number;
  activeServices: number;
  avgBookingValueCents: number;
  avgCustomerSpendCents: number;
}

export interface RecentBookingRow {
  id: string;
  customerName: string;
  serviceName: string;
  startsAt: Date;
  status: string;
  amountCents: number;
}

export interface RecentPaymentRow {
  id: string;
  customerName: string;
  method: string;
  status: string;
  amountCents: number;
  currency: string;
  paidAt: Date | null;
}

export interface TopCustomerRow {
  id: string;
  name: string;
  totalSpentCents: number;
  bookings: number;
}

export interface TopServiceRow {
  id: string;
  name: string;
  bookings: number;
  revenueCents: number;
}

export interface AnalyticsData {
  kpis: AnalyticsKpis;
  revenue: {
    daily: AnalyticsPoint[];
    weekly: AnalyticsPoint[];
    monthly: AnalyticsPoint[];
  };
  bookingStatus: StatusCount[];
  bookingsPerDay: AnalyticsPoint[];
  newCustomers: AnalyticsPoint[];
  topServices: TopServiceRow[];
  paymentMethods: StatusCount[];
  paymentStatus: StatusCount[];
  recentBookings: RecentBookingRow[];
  recentPayments: RecentPaymentRow[];
  topCustomers: TopCustomerRow[];
}
