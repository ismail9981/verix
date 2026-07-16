import { z } from "zod";
import { cleanOptional } from "./shared";
import { hasAtMostCentsPrecision, isReservationBlockingStatus, type ReservationStatusValue } from "./reservation";

/*
 * Validation + shared types for rental units (rooms/apartments/villas) — the
 * bookable inventory `reservation.ts` reserves, homed under a property and
 * building (Sprint 12's property -> building -> rental-unit hierarchy).
 * Dependency-free (no db/env imports) so every invariant here is
 * unit-testable — mirrors the split `reservation.ts` established between
 * pure decisions and `.service.ts`'s DB access.
 */

export const UNIT_TYPES = ["room", "apartment", "villa", "other"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

/**
 * A manual override of a unit's operational condition — the three states
 * with no reservation signal to derive from. Mirrors the DB's
 * `rental_unit_condition` enum. `null` (absent) means "no override."
 */
export const UNIT_CONDITION_OVERRIDES = [
  "cleaning",
  "maintenance",
  "out_of_service",
] as const;
export type UnitConditionOverride = (typeof UNIT_CONDITION_OVERRIDES)[number];

/**
 * The full 6-value status shown in the UI/dashboard. `available`,
 * `occupied`, and `reserved` are never stored — they're derived at read time
 * by `resolveUnitDisplayStatus` from whether a reservation currently covers
 * "today" for that unit. The other three are exactly `UNIT_CONDITION_OVERRIDES`.
 */
export const UNIT_DISPLAY_STATUSES = [
  "available",
  "occupied",
  "reserved",
  ...UNIT_CONDITION_OVERRIDES,
] as const;
export type UnitDisplayStatus = (typeof UNIT_DISPLAY_STATUSES)[number];

export const UNIT_DISPLAY_FILTER_STATUSES = [
  "all",
  ...UNIT_DISPLAY_STATUSES,
] as const;
export type UnitDisplayFilterStatus =
  (typeof UNIT_DISPLAY_FILTER_STATUSES)[number];

/**
 * Resolves a unit's displayed status from its manual override (if any) and
 * the status of whatever reservation currently covers "today" for it (if
 * any — pass `null` when none does). An override always wins: a unit flagged
 * `maintenance` reads as "under maintenance" even with no active reservation.
 *
 * Absent an override, this defers entirely to `isReservationBlockingStatus`
 * — the same single source of truth `checkAvailability`'s overlap check
 * uses — rather than hand-listing which statuses count. `checked_in` reads
 * as `occupied`. Every other *blocking* status (`inquiry`/`pending`/
 * `confirmed`/`checked_out`) reads as `reserved`: this deliberately includes
 * `checked_out`, because an employee can end a stay early
 * (`checked_in`→`checked_out` has no date validation), and the reservation's
 * date range still blocks new overlapping bookings until its scheduled
 * `checkOutDate` — the unit must never display `available` while the
 * booking flow would still reject a reservation for that range. Only a
 * non-blocking covering status (`cancelled`/`no_show` — which
 * `getCoveringReservationStatuses` already excludes from ever reaching here)
 * or no covering reservation at all reads as `available`.
 */
export function resolveUnitDisplayStatus(params: {
  override: UnitConditionOverride | null;
  coveringReservationStatus: ReservationStatusValue | null;
}): UnitDisplayStatus {
  if (params.override) return params.override;
  const status = params.coveringReservationStatus;
  if (status === null || !isReservationBlockingStatus(status)) return "available";
  return status === "checked_in" ? "occupied" : "reserved";
}

/** id/name/rate triple for the reservation form's unit selector — carries a default rate so create can prefill price. */
export interface RentalUnitOption {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
}

export interface RentalUnitListItem {
  id: string;
  propertyId: string;
  propertyName: string;
  buildingId: string;
  buildingName: string;
  name: string;
  unitNumber: string | null;
  floor: number | null;
  unitType: UnitType;
  description: string | null;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  sizeSqFt: number | null;
  amenities: string[];
  notes: string | null;
  priceCents: number;
  currency: string;
  statusOverride: UnitConditionOverride | null;
  displayStatus: UnitDisplayStatus;
  createdAt: Date;
}

/**
 * `amenities` arrives from the form as a single comma-separated string (no
 * existing multi-value/tag form input exists anywhere in this codebase to
 * reuse, and a comma-separated text field is the simplest correct match for
 * a short, free-form tag list) — preprocessed into a trimmed, de-duplicated
 * array before validation.
 */
function splitAmenities(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const seen = new Set<string>();
  for (const raw of value.split(",")) {
    const trimmed = raw.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

/**
 * `amount` arrives in the major unit (dollars); the service converts to
 * `priceCents`. No `currency` field — a unit's rate is always denominated in
 * the workspace's own currency (`workspaces.currency`), resolved server-side
 * (see `reservation.ts`'s matching note for why per-record currency overrides
 * were removed). Also deliberately no `propertyId`/`buildingId` — a unit's
 * placement is fixed by the route it's managed from (see
 * `rental-unit.service.ts`'s module doc comment), never a field in this form.
 */
export const rentalUnitInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  unitNumber: z.preprocess(cleanOptional, z.string().max(40).optional()),
  floor: z.preprocess(cleanOptional, z.coerce.number().int().min(-10).max(500).optional()),
  unitType: z.enum(UNIT_TYPES).default("room"),
  description: z.preprocess(cleanOptional, z.string().max(1000).optional()),
  capacity: z.coerce.number().int().min(1, "Must be at least 1").max(1000),
  bedrooms: z.coerce.number().int().min(0, "Can't be negative").max(50).default(0),
  bathrooms: z.coerce.number().int().min(0, "Can't be negative").max(50).default(0),
  sizeSqFt: z.preprocess(cleanOptional, z.coerce.number().int().min(0).max(1_000_000).optional()),
  amenities: z.preprocess(splitAmenities, z.array(z.string().trim().min(1).max(60)).max(50)).default([]),
  notes: z.preprocess(cleanOptional, z.string().max(1000).optional()),
  amount: z.coerce
    .number()
    .min(0, "Can't be negative")
    .max(1_000_000, "Too large")
    .refine(hasAtMostCentsPrecision, "Amount can't have more than 2 decimal places"),
  statusOverride: z.preprocess(cleanOptional, z.enum(UNIT_CONDITION_OVERRIDES).optional()),
});
export type RentalUnitInput = z.infer<typeof rentalUnitInputSchema>;

export const rentalUnitFiltersSchema = z.object({
  status: z.enum(UNIT_DISPLAY_FILTER_STATUSES).catch("all"),
  buildingId: z.union([z.literal("all"), z.uuid()]).catch("all"),
});
export type RentalUnitFilters = z.infer<typeof rentalUnitFiltersSchema>;
