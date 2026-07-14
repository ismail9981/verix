import { getPublishedSnapshot } from "../../../../../src/server/services/website-publish.service";
import { resolveSiteUrlContext, siteOrigin } from "../../../../../src/server/hosting/site-url";
import { buildSitemapEntries, buildSitemapXml, EMPTY_SITEMAP_XML } from "../../../../../src/website/render/seo-output";

/*
 * Host-aware sitemap.xml for one site (Sprint 8) — one indexed snapshot read
 * + one canonical-hostname read, no per-page queries. Missing/unpublished
 * sites and sites with no eligible domain yet get a safe, valid, empty
 * sitemap rather than an error (a crawler treats either the same way).
 */

export const dynamic = "force-dynamic";

interface RouteParams {
  siteId: string;
}

function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const { siteId } = await params;
  const snapshot = await getPublishedSnapshot(siteId);
  if (!snapshot) return xmlResponse(EMPTY_SITEMAP_XML);

  const ctx = await resolveSiteUrlContext(siteId);
  const origin = siteOrigin(ctx);
  if (!origin) return xmlResponse(EMPTY_SITEMAP_XML);

  const entries = buildSitemapEntries(snapshot, origin);
  return xmlResponse(buildSitemapXml(entries));
}
