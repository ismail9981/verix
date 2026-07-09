import { Badge, type BadgeTone } from "../ui/badge";
import type { CustomerStatus } from "./types";

const TONES: Record<CustomerStatus, BadgeTone> = {
  Active: "success",
  New: "info",
  VIP: "warning",
  Inactive: "neutral",
};

export function StatusPill({ status }: { status: CustomerStatus }) {
  return <Badge tone={TONES[status]}>{status}</Badge>;
}

export function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex rounded-md border border-hairline bg-canvas/60 px-2 py-0.5 text-[11px] text-muted">
      {tag}
    </span>
  );
}
