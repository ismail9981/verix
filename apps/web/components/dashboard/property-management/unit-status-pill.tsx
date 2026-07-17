import { Badge, type BadgeTone } from "../ui/badge";
import type { UnitDisplayStatus } from "../../../src/server/validators/rental-unit";

const LABELS: Record<UnitDisplayStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
  out_of_service: "Out of service",
};

const TONES: Record<UnitDisplayStatus, BadgeTone> = {
  available: "success",
  occupied: "accent",
  reserved: "info",
  cleaning: "warning",
  maintenance: "warning",
  out_of_service: "danger",
};

export function unitStatusLabel(status: UnitDisplayStatus): string {
  return LABELS[status];
}

export function UnitStatusPill({ status }: { status: UnitDisplayStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}
