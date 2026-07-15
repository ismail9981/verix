import { z } from "zod";
import { cleanOptional } from "./shared";
import { LEAD_STATUSES, type LeadStatus } from "./lead-public";

/*
 * Validation + shared types for the dashboard Leads module. Mirrors
 * `validators/customer.ts`'s shape (list DTO, stats, filters schema) for a
 * consistent feature-triad pattern. Public-submission-only concerns (field
 * limits, honeypot, form-section resolution, duplicate-customer matching,
 * status-transition rules) live in `lead-public.ts`, which this re-exports
 * the status vocabulary from rather than redeclaring it.
 */

export { LEAD_STATUSES, type LeadStatus } from "./lead-public";

export const LEAD_FILTER_STATUSES = ["all", ...LEAD_STATUSES] as const;
export type LeadFilterStatus = (typeof LEAD_FILTER_STATUSES)[number];

/** Lean DTO sent from the server to the dashboard list/drawer. */
export interface LeadListItem {
  id: string;
  siteId: string;
  siteName: string;
  pagePath: string;
  sourceDomain: string | null;
  formKey: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string | null;
  status: LeadStatus;
  convertedCustomerId: string | null;
  createdAt: Date;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  archived: number;
  spam: number;
}

export const leadFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(LEAD_FILTER_STATUSES).catch("all"),
  siteId: z.preprocess(cleanOptional, z.uuid().optional()),
  from: z.preprocess(cleanOptional, z.iso.date().optional()),
  to: z.preprocess(cleanOptional, z.iso.date().optional()),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

export const leadStatusUpdateSchema = z.object({
  status: z.enum(LEAD_STATUSES),
});
