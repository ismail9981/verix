import { z } from "zod";
import { cleanOptional } from "./shared";

/*
 * Validation + shared types for properties (Sprint 12) — the top level of the
 * property -> building -> rental-unit hierarchy. Dependency-free (no db/env
 * imports) so every invariant here is unit-testable, mirroring the split
 * `reservation.ts` established between pure decisions and `.service.ts`'s DB
 * access.
 */

export interface PropertyListItem {
  id: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  description: string | null;
  archivedAt: Date | null;
  buildingCount: number;
  unitCount: number;
  createdAt: Date;
}

/** id/name pair for a building/unit form's property selector. */
export interface PropertyOption {
  id: string;
  name: string;
}

export const propertyInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  addressLine1: z.preprocess(cleanOptional, z.string().max(200).optional()),
  addressLine2: z.preprocess(cleanOptional, z.string().max(200).optional()),
  city: z.preprocess(cleanOptional, z.string().max(120).optional()),
  state: z.preprocess(cleanOptional, z.string().max(120).optional()),
  postalCode: z.preprocess(cleanOptional, z.string().max(20).optional()),
  country: z.preprocess(cleanOptional, z.string().max(120).optional()),
  description: z.preprocess(cleanOptional, z.string().max(1000).optional()),
});
export type PropertyInput = z.infer<typeof propertyInputSchema>;

export const propertyFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
});
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>;
