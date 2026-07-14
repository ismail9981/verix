import "server-only";
import { env } from "../env";
import { getCanonicalHostnameForSite } from "./site-resolver.service";
import { normalizePath } from "../../website/render/snapshot";

/*
 * Shared public-URL resolution for a site (Sprint 8). One canonical builder
 * reused by the page renderer's `generateMetadata`, `robots.txt`,
 * `sitemap.xml`, and the social-image route — so canonical/eligible-domain
 * logic lives in exactly one place, per the "no duplicate metadata logic"
 * rule. Mirrors the domain-first, internal-path-fallback rule already used
 * by the public page route (Sprint 7.3): a site's real eligible domain always
 * wins, regardless of which hostname served the current request.
 */

export interface SiteUrlContext {
  /** The eligible hostname for this site, or `null` if it has none yet. */
  hostname: string | null;
  /** `https` in production, `http` only for local/dev convenience. */
  protocol: "http" | "https";
}

/** Resolves the one canonical-URL context for a site — a single DB read, shared by all callers in a request. */
export async function resolveSiteUrlContext(siteId: string): Promise<SiteUrlContext> {
  const hostname = await getCanonicalHostnameForSite(siteId);
  return { hostname, protocol: env.NODE_ENV === "production" ? "https" : "http" };
}

function internalCanonicalPath(siteId: string, pagePath: string): string {
  const normalized = normalizePath(pagePath);
  return normalized ? `/site/${siteId}/${normalized}` : `/site/${siteId}`;
}

/**
 * The canonical URL for a page path. Falls back to the internal
 * `/site/{siteId}` debug path only when the site has no eligible domain —
 * that internal path must never be canonical once a real domain exists.
 */
export function canonicalUrlFor(
  ctx: SiteUrlContext,
  siteId: string,
  pagePath: string,
): string {
  if (!ctx.hostname) return internalCanonicalPath(siteId, pagePath);
  const suffix = normalizePath(pagePath);
  return `${ctx.protocol}://${ctx.hostname}${suffix ? `/${suffix}` : ""}`;
}

/** The site's public origin (no path), or `null` if it has no eligible domain. */
export function siteOrigin(ctx: SiteUrlContext): string | null {
  return ctx.hostname ? `${ctx.protocol}://${ctx.hostname}` : null;
}
