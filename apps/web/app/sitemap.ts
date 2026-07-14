import type { MetadataRoute } from "next";

/*
 * The app/dashboard host's own sitemap.xml (Sprint 8) — always empty. Never
 * enumerate customer sites/workspaces here; each site's real sitemap is
 * served per-site from `app/(public)/site/[siteId]/sitemap.xml/route.ts`,
 * reached only via that site's own resolved public hostname.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
