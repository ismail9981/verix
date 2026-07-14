import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedSnapshot } from "../../../../../src/server/services/website-publish.service";
import { canonicalUrlFor, resolveSiteUrlContext, siteOrigin } from "../../../../../src/server/hosting/site-url";
import { selectSnapshotPage } from "../../../../../src/website/render/snapshot";
import { SnapshotPageView } from "../../../../../src/website/render/snapshot-renderer";
import {
  buildPageMetadata,
  buildStructuredData,
  findLocaleVariants,
  nonIndexableMetadata,
  serializeJsonLd,
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

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { siteId, path } = await params;
  const { locale } = await searchParams;
  const snapshot = await getPublishedSnapshot(siteId);
  if (!snapshot) return nonIndexableMetadata();

  const page = selectSnapshotPage(snapshot, joinPath(path), locale);
  if (!page) return nonIndexableMetadata();

  const ctx = await resolveSiteUrlContext(siteId);
  const canonical = canonicalUrlFor(ctx, siteId, page.path);
  const origin = siteOrigin(ctx);

  const variants = findLocaleVariants(snapshot, page);
  const alternateLanguageUrls = Object.fromEntries(
    variants.map((v) => [v.locale, `${canonical}?locale=${v.locale}`]),
  );

  return buildPageMetadata(snapshot, page, canonical, origin, alternateLanguageUrls);
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

  const ctx = await resolveSiteUrlContext(siteId);
  const canonical = canonicalUrlFor(ctx, siteId, page.path);
  const origin = siteOrigin(ctx);

  const jsonLd = serializeJsonLd(buildStructuredData(snapshot, page, canonical, origin));

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
