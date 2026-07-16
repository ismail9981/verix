import { Badge, type BadgeTone } from "../ui/badge";
import type { ReservationStatusLabel } from "./types";

const RESERVATION_TONES: Record<ReservationStatusLabel, BadgeTone> = {
  Inquiry: "neutral",
  Pending: "warning",
  Confirmed: "info",
  "Checked in": "accent",
  "Checked out": "success",
  Cancelled: "danger",
  "No-show": "danger",
};

export function StatusPill({ status }: { status: ReservationStatusLabel }) {
  return <Badge tone={RESERVATION_TONES[status]}>{status}</Badge>;
}
