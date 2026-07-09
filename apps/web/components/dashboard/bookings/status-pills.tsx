import { Badge, type BadgeTone } from "../ui/badge";
import type { BookingStatus, PaymentStatus } from "./types";

const BOOKING_TONES: Record<BookingStatus, BadgeTone> = {
  Confirmed: "success",
  Pending: "warning",
  Completed: "info",
  Cancelled: "danger",
};

const PAYMENT_TONES: Record<PaymentStatus, BadgeTone> = {
  Paid: "success",
  Unpaid: "warning",
  Refunded: "neutral",
};

export function StatusPill({ status }: { status: BookingStatus }) {
  return <Badge tone={BOOKING_TONES[status]}>{status}</Badge>;
}

export function PaymentPill({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONES[status]}>{status}</Badge>;
}
