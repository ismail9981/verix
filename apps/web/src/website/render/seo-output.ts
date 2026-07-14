import type { SiteSnapshot, SnapshotPage } from "./snapshot";
import { normalizePath } from "./snapshot";
import { resolveSiteIndexable } from "./site-metadata";

/*
 * Pure `robots.txt` / `sitemap.xml` text generation (Sprint 8). No db — the
 * Route Handlers under `app/(public)/site/[siteId]/` resolve the snapshot +
 * canonical origin once and hand them to these functions. Kept separate from
 * `site-metadata.ts` (which builds Next `Metadata`/JSON-LD) since these
 * produce raw text/XML bodies instead.
 */

/** A conservative default: crawl nothing. Used for every non-public/ineligible/unresolved context. */
export const DISALLOW_ALL_ROBOTS_TXT = "User-agent: *\nDisallow: /\n";

export interface RobotsTxtOptions {
  /** Site-level indexability switch (folds in "no eligible domain yet" from the caller). */
  indexable: boolean;
  /** Absolute sitemap URL, included only when the site is indexable and has one. */
  sitemapUrl?: string | null;
}

export function buildRobotsTxt(options: RobotsTxtOptions): string {
  if (!options.indexable) return DISALLOW_ALL_ROBOTS_TXT;
  const lines = ["User-agent: *", "Allow: /"];
  if (options.sitemapUrl) lines.push("", `Sitemap: ${options.sitemapUrl}`);
  return lines.join("\n") + "\n";
}

/** Escapes text for safe embedding in XML content (sitemap `<loc>`/urls are already-encoded URLs, but titles/paths may contain reserved characters). */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
  /** Other-locale absolute URLs for the same logical page, keyed by locale — rendered as `<xhtml:link>` alternates. */
  alternates?: Record<string, string>;
}

/** One `<url>` entry (page + locale variants folded together — a locale variant is not a separate sitemap entry). */
function pageEntry(
  page: SnapshotPage,
  snapshot: SiteSnapshot,
  origin: string,
  siblings: SnapshotPage[],
): SitemapUrlEntry {
  const suffix = normalizePath(page.path);
  const loc = `${origin}${suffix ? `/${suffix}` : ""}`;
  const alternates: Record<string, string> = {};
  for (const sibling of siblings) {
    if (sibling.id === page.id || sibling.locale === page.locale) continue;
    if (normalizePath(sibling.path) !== suffix) continue;
    alternates[sibling.locale] = `${loc}?locale=${sibling.locale}`;
  }
  return {
    loc,
    lastmod: snapshot.publishedAt,
    ...(Object.keys(alternates).length > 0 ? { alternates } : {}),
  };
}

/**
 * Builds the sitemap's page list: published pages only (the snapshot is
 * already publish-only), excluding `noindex` pages. One entry per distinct
 * path — locale variants attach as `<xhtml:link>` alternates on that entry
 * rather than duplicate `<url>` rows.
 */
export function buildSitemapEntries(snapshot: SiteSnapshot, origin: string): SitemapUrlEntry[] {
  if (!resolveSiteIndexable(snapshot)) return [];

  const seenPaths = new Set<string>();
  const entries: SitemapUrlEntry[] = [];
  for (const page of snapshot.pages) {
    if (page.seo.noIndex) continue;
    const normalized = normalizePath(page.path);
    if (seenPaths.has(normalized)) continue;
    seenPaths.add(normalized);
    entries.push(pageEntry(page, snapshot, origin, snapshot.pages));
  }
  return entries;
}

export function buildSitemapXml(entries: SitemapUrlEntry[]): string {
  const urls = entries
    .map((entry) => {
      const alternateLinks = Object.entries(entry.alternates ?? {})
        .map(
          ([locale, href]) =>
            `    <xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(href)}" />`,
        )
        .join("\n");
      return [
        "  <url>",
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        entry.lastmod ? `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : undefined,
        alternateLinks || undefined,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    urls +
    (urls ? "\n" : "") +
    "</urlset>\n"
  );
}

/** An always-valid, empty sitemap — for a resolved-but-empty or edge-case site rather than a hard error. */
export const EMPTY_SITEMAP_XML = buildSitemapXml([]);
