import type { InvoiceStatusLabel } from "./types";
import type {
  InvoiceLineItemType,
  InvoiceStatusValue,
} from "../../../src/server/validators/invoice";
import type { PaymentMethodValue } from "../../../src/server/validators/payment";

/* Presentation helpers for invoices. Avatar helpers are shared. */

export { avatarColor, initials } from "../ui/avatar";

const STATUS_LABELS: Record<InvoiceStatusValue, InvoiceStatusLabel> = {
  draft: "Draft",
  open: "Open",
  paid: "Paid",
  void: "Void",
  written_off: "Written off",
};

export function statusLabel(status: InvoiceStatusValue): InvoiceStatusLabel {
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

const LINE_ITEM_TYPE_LABELS: Record<InvoiceLineItemType, string> = {
  stay: "Stay",
  fee: "Fee",
  tax: "Tax",
  discount: "Discount",
};

export function lineItemTypeLabel(type: InvoiceLineItemType): string {
  return LINE_ITEM_TYPE_LABELS[type];
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
