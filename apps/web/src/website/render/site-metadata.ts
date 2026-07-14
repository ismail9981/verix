import type { Metadata } from "next";
import type { SiteSnapshot, SnapshotPage, SnapshotSection } from "./snapshot";
import { normalizePath } from "./snapshot";

/*
 * SEO metadata + structured-data generation from a compiled snapshot (Sprint
 * 8 extends the Sprint-1 version). Pure, dependency-free functions over the
 * frozen document — no db, no `server-only` import — so the public route's
 * `generateMetadata()` stays a single cached read with no extra queries, and
 * every rule here is unit-testable without a database. Callers (the page
 * route, robots/sitemap/social-image routes) supply the one resolved
 * canonical-URL context (`site-url.ts`) rather than each re-deriving it —
 * this file is the single shared generator; no second metadata pipeline.
 *
 * Fallback order, throughout: page-level SEO field → site-level default →
 * safe structural fallback (page title / omitted). Never fabricated.
 */

/** `%s` in a site's title template is replaced with the resolved page title. */
function applyTitleTemplate(template: string | null | undefined, base: string): string {
  const trimmed = template?.trim();
  if (!trimmed) return base;
  return trimmed.includes("%s") ? trimmed.replace(/%s/g, base) : trimmed;
}

/** Compose the final `<title>`: page SEO title → site default title → page title, then the site's template (or the historical `title · siteName` composition). Exported for reuse by the social-image route — one title-composition rule, not a second copy. */
export function composeTitle(page: SnapshotPage, snapshot: SiteSnapshot): string {
  const siteName = snapshot.site.name;
  const base =
    page.seo.title?.trim() || snapshot.site.seo?.defaultTitle?.trim() || page.title.trim();
  if (!base) return siteName;

  const template = snapshot.site.seo?.titleTemplate;
  if (template?.trim()) return applyTitleTemplate(template, base);
  return base === siteName ? base : `${base} · ${siteName}`;
}

function composeDescription(page: SnapshotPage, snapshot: SiteSnapshot): string | undefined {
  return page.seo.description?.trim() || snapshot.site.seo?.defaultDescription?.trim() || undefined;
}

/** Site-level master indexability switch. Absent (pre-Sprint-8 snapshot) → indexable. */
export function resolveSiteIndexable(snapshot: SiteSnapshot): boolean {
  return snapshot.site.seo?.indexable ?? true;
}

/** Effective per-page robots directives, folding in the site-level switch. */
function resolveRobots(page: SnapshotPage, snapshot: SiteSnapshot): { index: boolean; follow: boolean } {
  const siteIndexable = resolveSiteIndexable(snapshot);
  const pageNoIndex = page.seo.noIndex ?? false;
  const pageNoFollow = page.seo.noFollow ?? false;
  return { index: siteIndexable && !pageNoIndex, follow: !pageNoFollow };
}

/** `Metadata` for a route that must never be indexable (missing/unpublished page/site). */
export function nonIndexableMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

/** Fallback branded OG image, generated on demand — only when the site has a real public origin. */
function generatedSocialImageUrl(
  origin: string | null,
  siteId: string,
  page: SnapshotPage,
): string | undefined {
  if (!origin) return undefined;
  const params = new URLSearchParams({ p: normalizePath(page.path), l: page.locale });
  return `${origin}/site/${siteId}/social-image?${params.toString()}`;
}

/** Page image → site default image → generated fallback. Never fabricated, never fetched remotely at generation time. */
function resolveSocialImage(
  page: SnapshotPage,
  snapshot: SiteSnapshot,
  origin: string | null,
): string | undefined {
  return (
    page.seo.ogImageUrl?.trim() ||
    snapshot.site.seo?.defaultImageUrl?.trim() ||
    generatedSocialImageUrl(origin, snapshot.site.id, page) ||
    undefined
  );
}

/** Other-locale variants of the same public path — the source for `alternates.languages`. */
export function findLocaleVariants(snapshot: SiteSnapshot, page: SnapshotPage): SnapshotPage[] {
  const wanted = normalizePath(page.path);
  return snapshot.pages.filter(
    (p) => p.id !== page.id && normalizePath(p.path) === wanted && p.locale !== page.locale,
  );
}

export function buildPageMetadata(
  snapshot: SiteSnapshot,
  page: SnapshotPage,
  canonical: string,
  origin: string | null = null,
  /** `canonical` for each other-locale variant, keyed by locale — built by the caller (needs the same URL context). */
  alternateLanguageUrls?: Record<string, string>,
): Metadata {
  const title = composeTitle(page, snapshot);
  const description = composeDescription(page, snapshot);
  const ogTitle = page.seo.ogTitle?.trim() || title;
  const ogDescription = page.seo.ogDescription?.trim() || description;
  const image = resolveSocialImage(page, snapshot, origin);
  const robots = resolveRobots(page, snapshot);

  return {
    title,
    description,
    alternates: {
      canonical,
      ...(alternateLanguageUrls && Object.keys(alternateLanguageUrls).length > 0
        ? { languages: alternateLanguageUrls }
        : {}),
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      siteName: snapshot.site.name,
      locale: page.locale,
      type: "website",
      ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      ...(image ? { images: [image] } : {}),
    },
    robots,
  };
}

// --- Structured data (JSON-LD) ---------------------------------------------

/** Escapes JSON-LD for safe embedding in a `<script>` tag (`<` can't survive as-is — it would close the tag). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildWebsiteJsonLd(
  snapshot: SiteSnapshot,
  origin: string | null = null,
): Record<string, unknown> {
  return {
    "@type": "WebSite",
    name: snapshot.site.name,
    ...(origin ? { url: origin } : {}),
    inLanguage: snapshot.site.defaultLocale,
  };
}

/** Finds the first frozen Contact section's props across the site — the only source of business contact data, since it was explicitly authored to be public. */
function findContactProps(snapshot: SiteSnapshot): Record<string, unknown> | undefined {
  for (const page of snapshot.pages) {
    const section = page.sections.find((s: SnapshotSection) => s.typeKey === "contact");
    if (section) return section.props;
  }
  return undefined;
}

export function buildOrganizationJsonLd(
  snapshot: SiteSnapshot,
  origin: string | null = null,
): Record<string, unknown> {
  const contact = findContactProps(snapshot);
  const email = typeof contact?.email === "string" && contact.email ? contact.email : undefined;
  const phone = typeof contact?.phone === "string" && contact.phone ? contact.phone : undefined;
  const logo = snapshot.site.seo?.defaultImageUrl?.trim() || undefined;

  return {
    "@type": "Organization",
    name: snapshot.site.name,
    ...(origin ? { url: origin } : {}),
    ...(logo ? { logo } : {}),
    ...(email || phone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            ...(email ? { email } : {}),
            ...(phone ? { telephone: phone } : {}),
            contactType: "customer service",
          },
        }
      : {}),
  };
}

export function buildWebPageJsonLd(
  page: SnapshotPage,
  snapshot: SiteSnapshot,
  canonical: string,
): Record<string, unknown> {
  const description = composeDescription(page, snapshot);
  return {
    "@type": "WebPage",
    name: page.seo.title?.trim() || page.title,
    url: canonical,
    ...(description ? { description } : {}),
    inLanguage: page.locale,
  };
}

/** Title-cases a URL path segment for a breadcrumb label (`our-team` → `Our Team`). */
function segmentLabel(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

/** Only emitted for nested paths (2+ segments) — a single-segment/home page has no useful breadcrumb. */
export function buildBreadcrumbJsonLd(
  page: SnapshotPage,
  origin: string | null = null,
): Record<string, unknown> | undefined {
  const normalized = normalizePath(page.path);
  const segments = normalized ? normalized.split("/") : [];
  if (segments.length < 2) return undefined;

  const items = segments.map((segment, i) => {
    const isLast = i === segments.length - 1;
    const href = origin ? `${origin}/${segments.slice(0, i + 1).join("/")}` : undefined;
    return {
      "@type": "ListItem",
      position: i + 2, // Home is position 1.
      name: isLast ? page.seo.title?.trim() || page.title : segmentLabel(segment),
      ...(href ? { item: href } : {}),
    };
  });

  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", ...(origin ? { item: origin } : {}) },
      ...items,
    ],
  };
}

interface FrozenServiceItem {
  id?: unknown;
  name?: unknown;
  description?: unknown;
}

/** `Service` entries from this page's frozen Services section(s) — never live/draft catalog rows. */
export function buildServiceJsonLd(
  page: SnapshotPage,
  snapshot: SiteSnapshot,
): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  for (const section of page.sections) {
    if (section.typeKey !== "services") continue;
    const data = section.data as { services?: FrozenServiceItem[] } | null;
    for (const item of data?.services ?? []) {
      if (typeof item.name !== "string" || !item.name) continue;
      results.push({
        "@type": "Service",
        name: item.name,
        ...(typeof item.description === "string" && item.description
          ? { description: item.description }
          : {}),
        provider: { "@type": "Organization", name: snapshot.site.name },
      });
    }
  }
  return results;
}

/** The full `@graph` for a page — one reusable structured-data document, rendered through a single `<script>` by the caller. */
export function buildStructuredData(
  snapshot: SiteSnapshot,
  page: SnapshotPage,
  canonical: string,
  origin: string | null,
): Record<string, unknown> {
  const graph = [
    buildWebsiteJsonLd(snapshot, origin),
    buildOrganizationJsonLd(snapshot, origin),
    buildWebPageJsonLd(page, snapshot, canonical),
    buildBreadcrumbJsonLd(page, origin),
    ...buildServiceJsonLd(page, snapshot),
  ].filter((v): v is Record<string, unknown> => v !== undefined);

  return { "@context": "https://schema.org", "@graph": graph };
}
