import type { BookingStatus } from "./types";
import type { BookingStatusValue } from "../../../src/server/validators/booking";

/* Presentation helpers: turn stored booking data into what the table and
   drawer render (labels, dates, times, duration). Avatar helpers are shared. */

export { avatarColor, initials } from "../ui/avatar";

const STATUS_LABELS: Record<BookingStatusValue, BookingStatus> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function statusLabel(status: BookingStatusValue): BookingStatus {
  return STATUS_LABELS[status];
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDuration(startsAt: Date, endsAt: Date): string {
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000,
    ),
  );
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

/** Format a Date for a `<input type="datetime-local">` default value. */
export function toDateTimeLocal(value: Date): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
