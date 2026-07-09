import { Badge, type BadgeTone } from "../ui/badge";
import type { PaymentStatus } from "./types";

const TONES: Record<PaymentStatus, BadgeTone> = {
  Paid: "success",
  Pending: "warning",
  Failed: "danger",
  Refunded: "neutral",
};

export function StatusPill({ status }: { status: PaymentStatus }) {
  return <Badge tone={TONES[status]}>{status}</Badge>;
}
