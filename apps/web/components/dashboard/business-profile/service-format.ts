import type { EntityStatus } from "./types";
import type { ServiceStatus } from "../../../src/server/validators/service";

/* Presentation helpers: convert stored domain values (minutes, cents, enum)
   into the strings the existing Services table renders. */

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

const STATUS_LABELS: Record<ServiceStatus, EntityStatus> = {
  active: "Active",
  draft: "Draft",
  inactive: "Inactive",
};

/** Maps the DB status enum to the capitalized label StatusBadge expects. */
export function statusLabel(status: ServiceStatus): EntityStatus {
  return STATUS_LABELS[status];
}
