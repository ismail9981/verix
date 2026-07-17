import type { ReservationStatusValue } from "../../../src/server/validators/reservation";
import type { ReservationStatusLabel } from "./types";

export { avatarColor, initials } from "../ui/avatar";
export { formatMoney } from "../ui/money";

const STATUS_LABELS: Record<ReservationStatusValue, ReservationStatusLabel> = {
  inquiry: "Inquiry",
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export function statusLabel(status: ReservationStatusValue): ReservationStatusLabel {
  return STATUS_LABELS[status];
}

/** Parses a plain `YYYY-MM-DD` date string as a local calendar date (never shifts a day via UTC parsing). */
function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseDateOnly(value));
}

export function formatDateShort(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parseDateOnly(value));
}

export function nightCount(checkInDate: string, checkOutDate: string): number {
  const ms = parseDateOnly(checkOutDate).getTime() - parseDateOnly(checkInDate).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}
