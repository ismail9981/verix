import { Badge, type BadgeTone } from "../ui/badge";
import type { LeadStatus } from "../../../src/server/validators/lead";
import { statusLabel } from "./lead-format";

const TONES: Record<LeadStatus, BadgeTone> = {
  new: "info",
  contacted: "accent",
  qualified: "warning",
  converted: "success",
  archived: "neutral",
  spam: "danger",
};

export function LeadStatusPill({ status }: { status: LeadStatus }) {
  return <Badge tone={TONES[status]}>{statusLabel(status)}</Badge>;
}
