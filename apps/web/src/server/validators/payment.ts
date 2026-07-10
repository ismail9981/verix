import { z } from "zod";
import { cleanOptional } from "./shared";

/*
 * Validation + shared types for the Payments feature.
 *
 * The form takes `amount` in the major unit (dollars) — the service converts
 * to integer cents. `paidAt` is an optional datetime-local. Filters are
 * normalized from URL search params.
 */

export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "card",
  "cash",
  "paypal",
  "bank_transfer",
] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD"] as const;

export const PAYMENT_FILTER_STATUSES = ["all", ...PAYMENT_STATUSES] as const;
export type PaymentFilterStatus = (typeof PAYMENT_FILTER_STATUSES)[number];

export const PAYMENT_FILTER_METHODS = ["all", ...PAYMENT_METHODS] as const;
export type PaymentFilterMethod = (typeof PAYMENT_FILTER_METHODS)[number];

/** Lean DTO (with joined customer/service names) sent to the client. */
export interface PaymentListItem {
  id: string;
  bookingId: string | null;
  customerId: string | null;
  customerName: string;
  serviceName: string | null;
  amountCents: number;
  currency: string;
  method: PaymentMethodValue;
  status: PaymentStatusValue;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
}

/** Booking selector option, carrying the details shown when picked. */
export interface PaymentBookingOption {
  id: string;
  customerId: string;
  customerName: string;
  serviceName: string;
  priceCents: number;
}

export interface PaymentStats {
  totalRevenueCents: number;
  pendingRevenueCents: number;
  refundedRevenueCents: number;
  paidCount: number;
  pendingCount: number;
  refundedCount: number;
}

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const paymentInputSchema = z.object({
  bookingId: z.uuid("Select a booking"),
  amount: z.coerce
    .number()
    .min(0, "Can't be negative")
    .max(1_000_000, "Too large"),
  currency: z.enum(PAYMENT_CURRENCIES),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATUSES),
  paidAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  notes: z.preprocess(cleanOptional, z.string().max(1000).optional()),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const paymentFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(PAYMENT_FILTER_STATUSES).catch("all"),
  method: z.enum(PAYMENT_FILTER_METHODS).catch("all"),
});

export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;

/** Sentinel thrown when a second paid payment is attempted for one booking. */
export const DUPLICATE_PAID_ERROR = "DUPLICATE_PAID";
