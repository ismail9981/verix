import type { StatusCount, TrafficSource } from "./types";

/* Presentation helpers for analytics: money/date formatting and the
   label + color config that turns raw enum counts into donut segments. */

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

interface SegmentConfig {
  key: string;
  label: string;
  color: string;
}

export const BOOKING_STATUS_CONFIG: SegmentConfig[] = [
  { key: "confirmed", label: "Confirmed", color: "#6d5ef9" },
  { key: "pending", label: "Pending", color: "#f59e0b" },
  { key: "completed", label: "Completed", color: "#3b82f6" },
  { key: "cancelled", label: "Cancelled", color: "#ef4444" },
];

export const PAYMENT_METHOD_CONFIG: SegmentConfig[] = [
  { key: "card", label: "Card", color: "#6d5ef9" },
  { key: "cash", label: "Cash", color: "#10b981" },
  { key: "paypal", label: "PayPal", color: "#3b82f6" },
  { key: "bank_transfer", label: "Bank transfer", color: "#8b5cf6" },
];

export const PAYMENT_STATUS_CONFIG: SegmentConfig[] = [
  { key: "paid", label: "Paid", color: "#10b981" },
  { key: "pending", label: "Pending", color: "#f59e0b" },
  { key: "failed", label: "Failed", color: "#ef4444" },
  { key: "refunded", label: "Refunded", color: "#a1a1aa" },
];

/** Build donut segments from raw counts using a label/color config. */
export function toSegments(
  counts: StatusCount[],
  config: SegmentConfig[],
): TrafficSource[] {
  const byKey = new Map(counts.map((c) => [c.key, c.count]));
  return config.map((c) => ({
    label: c.label,
    value: byKey.get(c.key) ?? 0,
    color: c.color,
  }));
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

export function titleize(value: string): string {
  return STATUS_LABELS[value] ?? value;
}

const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  paypal: "PayPal",
  bank_transfer: "Bank transfer",
};

export function methodLabel(value: string): string {
  return METHOD_LABELS[value] ?? value;
}
