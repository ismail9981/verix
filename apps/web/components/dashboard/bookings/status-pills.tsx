import type { BookingStatus, PaymentStatus } from "./types";

const BOOKING_STYLES: Record<BookingStatus, string> = {
  Confirmed: "bg-emerald-500/10 text-emerald-400",
  Pending: "bg-amber-500/10 text-amber-400",
  Completed: "bg-sky-500/10 text-sky-400",
  Cancelled: "bg-red-500/10 text-red-400",
};

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  Paid: "bg-emerald-500/10 text-emerald-400",
  Unpaid: "bg-amber-500/10 text-amber-400",
  Refunded: "bg-white/5 text-muted",
};

export function StatusPill({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${BOOKING_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function PaymentPill({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${PAYMENT_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
