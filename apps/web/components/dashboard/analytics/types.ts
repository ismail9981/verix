/* Chart primitive types (consumed by line/bar/donut charts). */
export interface ChartPoint {
  label: string;
  value: number;
}

export interface TrafficSource {
  label: string;
  value: number;
  color: string;
}

/* Server-computed DTOs, re-exported for client widgets. */
export type {
  AnalyticsData,
  AnalyticsKpis,
  AnalyticsPoint,
  StatusCount,
  RecentBookingRow,
  RecentPaymentRow,
  TopCustomerRow,
  TopServiceRow,
} from "../../../src/server/validators/analytics";
