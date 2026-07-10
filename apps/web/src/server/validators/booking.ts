import { z } from "zod";
import { cleanOptional } from "./shared";

/*
 * Validation + shared types for the Bookings feature.
 *
 * `bookingInputSchema` validates create/update form data. `starts_at`/`ends_at`
 * arrive as datetime-local strings and are coerced to Date; a refinement
 * guarantees the booking ends after it starts. `bookingFiltersSchema`
 * normalizes the URL search params used for server-side listing.
 */

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
] as const;
export type BookingStatusValue = (typeof BOOKING_STATUSES)[number];

export const BOOKING_FILTER_STATUSES = ["all", ...BOOKING_STATUSES] as const;
export type BookingFilterStatus = (typeof BOOKING_FILTER_STATUSES)[number];

/** Lean DTO (with joined customer/service names) sent to the client. */
export interface BookingListItem {
  id: string;
  customerId: string;
  customerName: string;
  serviceId: string;
  serviceName: string;
  status: BookingStatusValue;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  createdAt: Date;
}

/** id/name pair for the customer & service selectors. */
export interface BookingOption {
  id: string;
  name: string;
}

export interface BookingStats {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
}

export const bookingInputSchema = z
  .object({
    customerId: z.uuid("Select a customer"),
    serviceId: z.uuid("Select a service"),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    status: z.enum(BOOKING_STATUSES),
    notes: z.preprocess(cleanOptional, z.string().max(1000).optional()),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "End time must be after the start time",
    path: ["endsAt"],
  });

export type BookingInput = z.infer<typeof bookingInputSchema>;

export const bookingFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(BOOKING_FILTER_STATUSES).catch("all"),
  service: z.union([z.literal("all"), z.uuid()]).catch("all"),
});

export type BookingFilters = z.infer<typeof bookingFiltersSchema>;
