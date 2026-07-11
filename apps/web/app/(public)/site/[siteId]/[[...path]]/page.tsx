import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedSnapshot } from "../../../../../src/server/services/website-publish.service";
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
 * the site (a single cached, zero-join row) — never the draft tables. Unknown
 * host/domain routing lands with custom domains (out of scope); this sprint the
 * site is addressed by id in the path, which a future host-rewrite targets.
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

function canonicalFor(siteId: string, pagePath: string): string {
  const normalized = normalizePath(pagePath);
  return normalized ? `/site/${siteId}/${normalized}` : `/site/${siteId}`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { siteId, path } = await params;
  const snapshot = await getPublishedSnapshot(siteId);
  if (!snapshot) return {};

  const page = selectSnapshotPage(snapshot, joinPath(path));
  if (!page) return {};

  return buildPageMetadata(snapshot, page, canonicalFor(siteId, page.path));
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
