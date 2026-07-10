import { Badge, type BadgeTone } from "../ui/badge";
import type { BookingStatus } from "./types";

const BOOKING_TONES: Record<BookingStatus, BadgeTone> = {
  Confirmed: "success",
  Pending: "warning",
  Completed: "info",
  Cancelled: "danger",
};

export function StatusPill({ status }: { status: BookingStatus }) {
  return <Badge tone={BOOKING_TONES[status]}>{status}</Badge>;
}
