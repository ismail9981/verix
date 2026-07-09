import { Badge, type BadgeTone } from "../ui/badge";
import type { EntityStatus } from "./types";

const TONES: Record<EntityStatus, BadgeTone> = {
  Active: "success",
  Draft: "warning",
  Inactive: "neutral",
};

export function StatusBadge({ status }: { status: EntityStatus }) {
  return <Badge tone={TONES[status]}>{status}</Badge>;
}
