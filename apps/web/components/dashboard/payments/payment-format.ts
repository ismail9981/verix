import type { PaymentStatus } from "./types";
import type {
  PaymentMethodValue,
  PaymentStatusValue,
} from "../../../src/server/validators/payment";

/* Presentation helpers for payments. Avatar helpers are shared. */

export { avatarColor, initials } from "../ui/avatar";

const STATUS_LABELS: Record<PaymentStatusValue, PaymentStatus> = {
  paid: "Paid",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
};

export function statusLabel(status: PaymentStatusValue): PaymentStatus {
  return STATUS_LABELS[status];
}

const METHOD_LABELS: Record<PaymentMethodValue, string> = {
  card: "Card",
  cash: "Cash",
  paypal: "PayPal",
  bank_transfer: "Bank transfer",
};

export function methodLabel(method: PaymentMethodValue): string {
  return METHOD_LABELS[method];
}

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

/** Short human-facing reference derived from the payment id. */
export function paymentRef(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/** Format a Date for a `<input type="datetime-local">` default value. */
export function toDateTimeLocal(value: Date): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
