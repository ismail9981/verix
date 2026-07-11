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

export const snapshotPageSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  locale: z.string(),
  position: z.number().int(),
  seo: z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
  }),
  sections: z.array(snapshotSectionSchema),
});
export type SnapshotPage = z.infer<typeof snapshotPageSchema>;

export const siteSnapshotSchema = z.object({
  format: z.literal(SNAPSHOT_FORMAT_VERSION),
  site: z.object({
    id: z.string(),
    name: z.string(),
    defaultLocale: z.string(),
    themeKey: z.string(),
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
