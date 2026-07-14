import { z } from "zod";
import { themeTokensSchema } from "../theme/tokens";

/*
 * The compiled site snapshot — the single, immutable, denormalized document a
 * published version stores and the public renderer reads from. Every reference
 * (theme tokens, live section data) is resolved and *frozen* at publish time,
 * so the public site renders with zero joins and can never be broken by a later
 * edit to the draft tables or the live catalog.
 *
 * These are shared, client-safe types (no server imports), consumed by both the
 * compiler (writes) and the renderer (reads). The Zod schema doubles as the
 * read-time guard: a snapshot that fails validation is treated as absent.
 */

/** Bump when the snapshot shape changes incompatibly (migrate-on-read later). */
export const SNAPSHOT_FORMAT_VERSION = 1;

export const snapshotSectionSchema = z.object({
  id: z.string(),
  typeKey: z.string(),
  typeVersion: z.number().int(),
  /** Validated section props, frozen. Re-validated by the registry at render. */
  props: z.record(z.string(), z.unknown()),
  /** Frozen resolved data (e.g. the Services grid) or null for prop-only sections. */
  data: z.unknown(),
});
export type SnapshotSection = z.infer<typeof snapshotSectionSchema>;

/*
 * `seo.*` beyond `title`/`description` (Sprint 8) are all `.optional()` —
 * never `.nullable()`-only — so a pre-Sprint-8 snapshot, which simply lacks
 * these keys, still satisfies this schema unchanged. `getPublishedSnapshot`
 * treats any parse failure as "site absent," so a non-optional addition here
 * would silently unpublish every site with an older snapshot on read.
 */
export const snapshotPageSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  locale: z.string(),
  position: z.number().int(),
  seo: z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    noIndex: z.boolean().optional(),
    noFollow: z.boolean().optional(),
    ogTitle: z.string().nullable().optional(),
    ogDescription: z.string().nullable().optional(),
    ogImageUrl: z.string().nullable().optional(),
  }),
  sections: z.array(snapshotSectionSchema),
});
export type SnapshotPage = z.infer<typeof snapshotPageSchema>;

/** Site-level SEO defaults (Sprint 8) — all optional for the same backward-compat reason as page `seo.*` above. */
export const siteSeoSchema = z.object({
  /** Falls back to the page title / site name when unset. */
  defaultTitle: z.string().nullable().optional(),
  /** `%s` is replaced with the resolved page title; applied only when set. */
  titleTemplate: z.string().nullable().optional(),
  defaultDescription: z.string().nullable().optional(),
  defaultImageUrl: z.string().nullable().optional(),
  /** Master indexability switch. Absent (older snapshot) → treated as indexable. */
  indexable: z.boolean().optional(),
});
export type SiteSeo = z.infer<typeof siteSeoSchema>;

export const siteSnapshotSchema = z.object({
  format: z.literal(SNAPSHOT_FORMAT_VERSION),
  site: z.object({
    id: z.string(),
    name: z.string(),
    defaultLocale: z.string(),
    themeKey: z.string(),
    seo: siteSeoSchema.optional(),
  }),
  theme: z.object({
    key: z.string(),
    tokens: themeTokensSchema,
  }),
  pages: z.array(snapshotPageSchema),
  publishedAt: z.string(),
});
export type SiteSnapshot = z.infer<typeof siteSnapshotSchema>;

/** Find the page matching a public path (`""` = home) and locale, with fallback. */
export function selectSnapshotPage(
  snapshot: SiteSnapshot,
  path: string,
  locale?: string,
): SnapshotPage | undefined {
  const wanted = normalizePath(path);
  const loc = locale ?? snapshot.site.defaultLocale;
  return (
    snapshot.pages.find((p) => normalizePath(p.path) === wanted && p.locale === loc) ??
    // Locale fallback: same path in the site's default locale.
    snapshot.pages.find(
      (p) =>
        normalizePath(p.path) === wanted &&
        p.locale === snapshot.site.defaultLocale,
    )
  );
}

/** Normalize a path for comparison: no leading/trailing slashes, lowercased. */
export function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "").toLowerCase();
}
