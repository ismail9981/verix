import type { Metadata } from "next";
import type { SiteSnapshot, SnapshotPage } from "./snapshot";

/*
 * SEO metadata generation from a compiled snapshot. Pure functions over the
 * frozen document, so the public route's generateMetadata() stays a single
 * cached read with no extra queries. Title falls back page → site; description
 * from page SEO; canonical/OG from the resolved public path.
 */

/** Compose `<page title> · <site name>`, avoiding duplication for the home title. */
function composeTitle(page: SnapshotPage, siteName: string): string {
  const base = page.seo.title?.trim() || page.title.trim();
  if (!base) return siteName;
  return base === siteName ? base : `${base} · ${siteName}`;
}

export function buildPageMetadata(
  snapshot: SiteSnapshot,
  page: SnapshotPage,
  canonicalPath: string,
): Metadata {
  const title = composeTitle(page, snapshot.site.name);
  const description = page.seo.description?.trim() || undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: snapshot.site.name,
      locale: page.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

/** Minimal WebSite JSON-LD for the site — extended with LocalBusiness later. */
export function buildWebsiteJsonLd(
  snapshot: SiteSnapshot,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: snapshot.site.name,
    inLanguage: snapshot.site.defaultLocale,
  };
}
