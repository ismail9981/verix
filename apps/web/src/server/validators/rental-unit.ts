import { z } from "zod";
import { cleanOptional } from "./shared";

/*
 * Validation + shared types for rental units (rooms/apartments/villas) — the
 * bookable inventory `reservation.ts` reserves. Mirrors `service.ts`'s shape
 * (name/description/rate/status) for the closest existing analog.
 */

export const UNIT_TYPES = ["room", "apartment", "villa", "other"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_STATUSES = ["active", "inactive"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const UNIT_FILTER_STATUSES = ["all", ...UNIT_STATUSES] as const;
export type UnitFilterStatus = (typeof UNIT_FILTER_STATUSES)[number];

export interface RentalUnitListItem {
  id: string;
  name: string;
  unitType: UnitType;
  description: string | null;
  capacity: number;
  priceCents: number;
  currency: string;
  status: UnitStatus;
  createdAt: Date;
}

/** id/name/rate triple for the reservation form's unit selector — carries a default rate so create can prefill price. */
export interface RentalUnitOption {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
}

/**
 * `amount` arrives in the major unit (dollars); the service converts to
 * `priceCents`. No `currency` field — a unit's rate is always denominated in
 * the workspace's own currency (`workspaces.currency`), resolved server-side
 * (see `reservation.ts`'s matching note for why per-record currency overrides
 * were removed).
 */
export const rentalUnitInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  unitType: z.enum(UNIT_TYPES).default("room"),
  description: z.preprocess(cleanOptional, z.string().max(1000).optional()),
  capacity: z.coerce.number().int().min(1, "Must be at least 1").max(1000),
  amount: z.coerce
    .number()
    .min(0, "Can't be negative")
    .max(1_000_000, "Too large"),
  status: z.enum(UNIT_STATUSES).default("active"),
});
export type RentalUnitInput = z.infer<typeof rentalUnitInputSchema>;

export const rentalUnitFiltersSchema = z.object({
  status: z.enum(UNIT_FILTER_STATUSES).catch("all"),
});
export type RentalUnitFilters = z.infer<typeof rentalUnitFiltersSchema>;
