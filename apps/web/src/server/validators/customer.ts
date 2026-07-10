import { z } from "zod";
import { cleanOptional } from "./shared";

/*
 * Validation + shared types for the CRM (Customers) feature.
 *
 * `customerInputSchema` validates create/update form data. `total_spent` is a
 * derived metric (accumulated from payments in a later phase), so it is not an
 * editable field here — new customers start at 0. `customerFiltersSchema`
 * normalizes the URL search params used for server-side listing.
 */

export const CUSTOMER_STATUSES = ["active", "new", "vip", "inactive"] as const;
export type CustomerStatusValue = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_FILTER_STATUSES = [
  "all",
  "active",
  "new",
  "vip",
  "inactive",
] as const;
export type CustomerFilterStatus = (typeof CUSTOMER_FILTER_STATUSES)[number];

/** Lean DTO sent from the server to the client list/drawer. */
export interface CustomerListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: CustomerStatusValue;
  totalSpentCents: number;
  notes: string | null;
  createdAt: Date;
}

export interface CustomerStats {
  total: number;
  active: number;
  new: number;
  vip: number;
}

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.preprocess(cleanOptional, z.email("Enter a valid email").optional()),
  phone: z.preprocess(cleanOptional, z.string().max(40).optional()),
  status: z.enum(CUSTOMER_STATUSES),
  notes: z.preprocess(cleanOptional, z.string().max(1000).optional()),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

export const customerFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(CUSTOMER_FILTER_STATUSES).catch("all"),
});

export type CustomerFilters = z.infer<typeof customerFiltersSchema>;
