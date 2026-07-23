import { Badge, type BadgeTone } from "../ui/badge";
import type { InvoiceStatusLabel } from "./types";

const TONES: Record<InvoiceStatusLabel, BadgeTone> = {
  Draft: "neutral",
  Open: "warning",
  Paid: "success",
  Void: "neutral",
  "Written off": "danger",
};

export function StatusPill({ status }: { status: InvoiceStatusLabel }) {
  return <Badge tone={TONES[status]}>{status}</Badge>;
}
