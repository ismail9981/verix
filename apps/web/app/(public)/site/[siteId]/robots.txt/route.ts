import { getPublishedSnapshot } from "../../../../../src/server/services/website-publish.service";
import { resolveSiteUrlContext, siteOrigin } from "../../../../../src/server/hosting/site-url";
import { resolveSiteIndexable } from "../../../../../src/website/render/site-metadata";
import { buildRobotsTxt, DISALLOW_ALL_ROBOTS_TXT } from "../../../../../src/website/render/seo-output";

/*
 * Host-aware robots.txt for one site (Sprint 8). Reached either directly
 * (dev/debug) or via `proxy.ts`'s host rewrite for a resolved public
 * hostname — the same routing this site's public page/sitemap/social-image
 * routes use. Reads only the published snapshot; an unpublished/missing site
 * or one with no eligible domain yet always gets the safe disallow-all
 * default, regardless of its own indexable setting.
 */

export const dynamic = "force-dynamic";

interface RouteParams {
  siteId: string;
}

function textResponse(body: string): Response {
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const { siteId } = await params;
  const snapshot = await getPublishedSnapshot(siteId);
  if (!snapshot) return textResponse(DISALLOW_ALL_ROBOTS_TXT);

  const ctx = await resolveSiteUrlContext(siteId);
  const origin = siteOrigin(ctx);
  // No eligible domain yet → this site has no real public identity to index,
  // regardless of its own indexable switch (mirrors the canonical-URL rule).
  const indexable = Boolean(origin) && resolveSiteIndexable(snapshot);

  return textResponse(
    buildRobotsTxt({ indexable, sitemapUrl: origin ? `${origin}/sitemap.xml` : null }),
  );
}
