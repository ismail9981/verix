import { z } from "zod";
import { cleanOptional } from "./shared";

/*
 * Validation + shared types for the Website Builder (Sprint 1: Sites, Pages,
 * Page Sections). Section `props` is free-form JSON this sprint — a per-type
 * registry lands in a later sprint.
 */

export const SITE_STATUSES = ["draft", "published", "unpublished"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const PAGE_STATUSES = ["draft", "ready"] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export const SITE_VERSION_STATUSES = [
  "published",
  "superseded",
  "archived",
] as const;
export type SiteVersionStatus = (typeof SITE_VERSION_STATUSES)[number];

// --- DTOs -----------------------------------------------------------------

export interface SiteListItem {
  id: string;
  name: string;
  defaultLocale: string;
  status: SiteStatus;
  themeKey: string | null;
  publishedVersionId: string | null;
  pageCount: number;
  createdAt: Date;
}

export interface SiteVersionListItem {
  id: string;
  versionNumber: number;
  status: SiteVersionStatus;
  label: string | null;
  publishedAt: Date;
  createdAt: Date;
  isLive: boolean;
}

/** A publish-time validation problem, surfaced to the editor before persisting. */
export interface PublishIssue {
  pageTitle: string;
  sectionKey: string;
  message: string;
}

export interface PageListItem {
  id: string;
  siteId: string;
  path: string;
  title: string;
  locale: string;
  status: PageStatus;
  position: number;
  seoTitle: string | null;
  seoDescription: string | null;
  sectionCount: number;
  createdAt: Date;
}

export interface PageSectionListItem {
  id: string;
  pageId: string;
  siteId: string;
  typeKey: string;
  typeVersion: number;
  position: number;
  props: Record<string, unknown>;
  isVisible: boolean;
  locale: string;
  createdAt: Date;
}

// --- Sites ----------------------------------------------------------------

export const siteInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  defaultLocale: z.string().trim().min(2).max(20).default("en-us"),
  status: z.enum(SITE_STATUSES).default("draft"),
  // A registry theme key; unknown/empty falls back to the default theme at
  // render time (validated leniently so a renamed theme never blocks a save).
  themeKey: z.preprocess(cleanOptional, z.string().max(64).optional()),
});
export type SiteInput = z.infer<typeof siteInputSchema>;

// --- Templates ------------------------------------------------------------

export const createSiteFromTemplateSchema = z.object({
  templateKey: z
    .string()
    .trim()
    .min(1, "Choose a template")
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  siteName: z.string().trim().min(1, "Name is required").max(120),
  locale: z.string().trim().min(2).max(20).default("en-us"),
});
export type CreateSiteFromTemplateInput = z.infer<
  typeof createSiteFromTemplateSchema
>;

// --- Publishing -----------------------------------------------------------

export const publishInputSchema = z.object({
  label: z.preprocess(cleanOptional, z.string().max(120).optional()),
});
export type PublishInput = z.infer<typeof publishInputSchema>;

// --- Pages ----------------------------------------------------------------

const pathSchema = z
  .string()
  .trim()
  .max(200)
  .regex(/^[a-z0-9\-/]*$/, "Use lowercase letters, numbers, hyphens and slashes");

export const pageInputSchema = z.object({
  path: pathSchema,
  title: z.string().trim().min(1, "Title is required").max(200),
  locale: z.string().trim().min(2).max(20).default("en-us"),
  status: z.enum(PAGE_STATUSES).default("draft"),
  position: z.coerce.number().int().min(0).max(10_000).default(0),
  seoTitle: z.preprocess(cleanOptional, z.string().max(200).optional()),
  seoDescription: z.preprocess(cleanOptional, z.string().max(500).optional()),
});
export type PageInput = z.infer<typeof pageInputSchema>;

/** Create also needs the parent site id. */
export const createPageSchema = pageInputSchema.extend({
  siteId: z.uuid("Select a site"),
});
export type CreatePageInput = z.infer<typeof createPageSchema>;

// --- Page sections --------------------------------------------------------

const propsSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return Number.NaN; // fails the record check below with a clear error
  }
}, z.record(z.string(), z.unknown()));

export const sectionInputSchema = z.object({
  typeKey: z
    .string()
    .trim()
    .min(1, "Type key is required")
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  typeVersion: z.coerce.number().int().min(1).max(1000).default(1),
  position: z.coerce.number().int().min(0).max(10_000).default(0),
  props: propsSchema,
  isVisible: z.preprocess((v) => v === "true" || v === true, z.boolean()),
  locale: z.string().trim().min(2).max(20).default("en-us"),
});
export type SectionInput = z.infer<typeof sectionInputSchema>;

/** Create also needs the parent page id. */
export const createSectionSchema = sectionInputSchema.extend({
  pageId: z.uuid("Select a page"),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

// --- Section sync (visual builder autosave) -------------------------------

/*
 * One desired section in the builder's draft. `id` may be a real uuid (existing
 * or previously-removed → restored) or a client temp id (`new-*` → inserted and
 * mapped back). Props are free-form here, exactly like the rest of the draft;
 * validation happens at publish time.
 */
export const syncSectionSchema = z.object({
  id: z.string().trim().min(1).max(64),
  typeKey: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  typeVersion: z.coerce.number().int().min(1).max(1000),
  props: z.record(z.string(), z.unknown()),
  isVisible: z.boolean(),
  locale: z.string().trim().min(2).max(20),
  position: z.coerce.number().int().min(0).max(100_000_000),
});
export type SyncSectionInput = z.infer<typeof syncSectionSchema>;

export const syncPageSectionsSchema = z.object({
  pageId: z.uuid("Select a page"),
  sections: z.array(syncSectionSchema).max(200),
});
export type SyncPageSectionsInput = z.infer<typeof syncPageSectionsSchema>;

/** Result of a sync: the authoritative sections + temp→real id mapping. */
export interface SyncSectionsResult {
  sections: PageSectionListItem[];
  idMap: Record<string, string>;
}
