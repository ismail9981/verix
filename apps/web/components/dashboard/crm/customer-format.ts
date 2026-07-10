import type { CustomerStatus } from "./types";
import type { CustomerStatusValue } from "../../../src/server/validators/customer";

/* Presentation helpers: turn stored customer data into what the table and
   drawer render (labels, currency, avatar initials/color, dates). */

// Avatar helpers are shared across list modules.
export { avatarColor, initials } from "../ui/avatar";

const STATUS_LABELS: Record<CustomerStatusValue, CustomerStatus> = {
  active: "Active",
  new: "New",
  vip: "VIP",
  inactive: "Inactive",
};

export function statusLabel(status: CustomerStatusValue): CustomerStatus {
  return STATUS_LABELS[status];
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

