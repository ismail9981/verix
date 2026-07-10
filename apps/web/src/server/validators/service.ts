import { z } from "zod";
import { cleanOptional } from "./shared";

/*
 * Validation + shared types for the Services feature.
 *
 * `serviceInputSchema` validates create/update form data. The form takes price
 * in dollars (friendlier to type); the service layer converts to integer cents
 * for storage. `serviceFiltersSchema` normalizes URL search params for listing.
 */

export const SERVICE_STATUSES = ["active", "draft", "inactive"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const SERVICE_FILTER_STATUSES = [
  "all",
  "active",
  "draft",
  "inactive",
] as const;
export type ServiceFilterStatus = (typeof SERVICE_FILTER_STATUSES)[number];

/** Lean DTO passed from the server to the client list (no timestamps/tenant id). */
export interface ServiceListItem {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  status: ServiceStatus;
}

export const serviceInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.preprocess(cleanOptional, z.string().max(500).optional()),
  durationMinutes: z.coerce
    .number()
    .int("Whole minutes only")
    .min(1, "At least 1 minute")
    .max(1440, "24 hours max"),
  price: z.coerce
    .number()
    .min(0, "Can't be negative")
    .max(100000, "Too large"),
  status: z.enum(SERVICE_STATUSES),
});

export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const serviceFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(SERVICE_FILTER_STATUSES).catch("all"),
});

export type ServiceFilters = z.infer<typeof serviceFiltersSchema>;
