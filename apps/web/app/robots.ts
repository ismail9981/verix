import type { MetadataRoute } from "next";

/*
 * The app/dashboard host's own robots.txt (Sprint 8) — always disallow-all.
 * This is a security boundary, not a nicety: `/site/{siteId}` is reachable
 * un-rewritten on the app host (`shouldSkipHostRewrite` in `hosting/host.ts`
 * skips the `/site` prefix), so this is what keeps crawlers off customer
 * content served there and off the authenticated dashboard routes. Every
 * customer site's own indexable robots.txt is served per-site instead, from
 * `app/(public)/site/[siteId]/robots.txt/route.ts`, reached only via a
 * resolved public hostname (`proxy.ts`).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
