import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedSnapshot } from "../../../../../src/server/services/website-publish.service";
import { getCanonicalHostnameForSite } from "../../../../../src/server/hosting/site-resolver.service";
import { env } from "../../../../../src/server/env";
import {
  normalizePath,
  selectSnapshotPage,
} from "../../../../../src/website/render/snapshot";
import { SnapshotPageView } from "../../../../../src/website/render/snapshot-renderer";
import {
  buildPageMetadata,
  buildWebsiteJsonLd,
} from "../../../../../src/website/render/site-metadata";

/*
 * Public multi-tenant renderer. Reads ONLY the published, compiled snapshot for
 * the site (a single cached, zero-join row) — never the draft tables. Reached
 * either directly (dev/debug) or via `proxy.ts`'s host-based rewrite (Sprint
 * 7.3), which targets this exact route for any resolved public hostname.
 */

interface RouteParams {
  siteId: string;
  path?: string[];
}

interface PageProps {
  params: Promise<RouteParams>;
  searchParams: Promise<{ locale?: string }>;
}

function joinPath(path?: string[]): string {
  return (path ?? []).join("/");
}

function internalCanonicalPath(siteId: string, pagePath: string): string {
  const normalized = normalizePath(pagePath);
  return normalized ? `/site/${siteId}/${normalized}` : `/site/${siteId}`;
}

/*
 * The site's real, eligible domain always wins as canonical when one exists —
 * regardless of whether this request arrived via that domain or via the
 * internal `/site/{siteId}` debug fallback. Falls back to the internal path
 * only when the site has no eligible domain yet.
 */
async function canonicalUrlFor(
  siteId: string,
  pagePath: string,
): Promise<string> {
  const internalPath = internalCanonicalPath(siteId, pagePath);
  const hostname = await getCanonicalHostnameForSite(siteId);
  if (!hostname) return internalPath;

  const protocol = env.NODE_ENV === "production" ? "https" : "http";
  const suffix = normalizePath(pagePath);
  return `${protocol}://${hostname}${suffix ? `/${suffix}` : ""}`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { siteId, path } = await params;
  const snapshot = await getPublishedSnapshot(siteId);
  if (!snapshot) return {};

  const page = selectSnapshotPage(snapshot, joinPath(path));
  if (!page) return {};

  const canonical = await canonicalUrlFor(siteId, page.path);
  return buildPageMetadata(snapshot, page, canonical);
}

export default async function PublicSitePage({
  params,
  searchParams,
}: PageProps) {
  const { siteId, path } = await params;
  const { locale } = await searchParams;

  const snapshot = await getPublishedSnapshot(siteId);
  if (!snapshot) notFound();

  const page = selectSnapshotPage(snapshot, joinPath(path), locale);
  if (!page) notFound();

  // Escape `<` so a value like a site name can't break out of the script tag.
  const jsonLd = JSON.stringify(buildWebsiteJsonLd(snapshot)).replace(
    /</g,
    "\\u003c",
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <SnapshotPageView page={page} tokens={snapshot.theme.tokens} />
    </>
  );
}
