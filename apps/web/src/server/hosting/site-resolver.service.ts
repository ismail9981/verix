import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { siteDomains, sites } from "../db/schema";
import { logger } from "../observability/logger";
import { normalizeHost } from "./host";
import {
  evaluateRoutingCandidate,
  selectCanonicalHostname,
  type SiteRouteDTO,
} from "./site-resolver";

/*
 * DB-backed host→site resolution (Sprint 7.3). Thin, atomic shell around the
 * pure decision logic in `./site-resolver` — mirrors the
 * `dns/verification.ts` + `domain-verification.service.ts` split. Runs from
 * `proxy.ts`, which (Next 16) always executes on the Node.js runtime, so a
 * direct postgres.js read here is safe.
 *
 * Uncached by design: one indexed, zero-extra-join query per public-host
 * request (app-host requests never reach this file), so publish/unpublish/
 * verification/primary changes are visible on the very next request. Tag- or
 * ISR-based caching is deferred to a later performance sprint (the same
 * deferral already made for `getPublishedSnapshot`).
 */

const ROUTING_SELECT = {
  domainId: siteDomains.id,
  siteId: siteDomains.siteId,
  hostname: siteDomains.hostname,
  domainType: siteDomains.type,
  domainStatus: siteDomains.status,
  isPrimary: siteDomains.isPrimary,
  siteStatus: sites.status,
  publishedVersionId: sites.publishedVersionId,
  // Selected even though the WHERE clause below already excludes soft-deleted
  // rows — `evaluateRoutingCandidate` re-checks these as defense in depth.
  domainDeletedAt: siteDomains.deletedAt,
  siteDeletedAt: sites.deletedAt,
} as const;

/**
 * Resolves a normalized hostname to a routing DTO, or `null` if it doesn't
 * map to a live, published, eligible site. Never throws — a DB error is
 * logged and treated as "unresolved" so a transient blip degrades to a safe
 * 404 instead of a 500 on every request to a public host.
 */
export async function resolveSiteByHostname(
  hostname: string,
  requestId: string,
): Promise<SiteRouteDTO | null> {
  const normalized = normalizeHost(hostname)?.hostname;
  if (!normalized) return null;

  try {
    const rows = await db
      .select(ROUTING_SELECT)
      .from(siteDomains)
      .innerJoin(sites, eq(sites.id, siteDomains.siteId))
      .where(
        and(
          eq(siteDomains.hostname, normalized),
          isNull(siteDomains.deletedAt),
          isNull(sites.deletedAt),
        ),
      )
      .limit(1);

    return evaluateRoutingCandidate(rows[0]);
  } catch (error) {
    logger.error("hosting.resolveSiteByHostname failed", {
      requestId,
      hostname: normalized,
      err: error,
    });
    return null;
  }
}

/**
 * The best hostname to use as a site's canonical URL (primary domain first),
 * or `null` if the site has no eligible domain — the caller then falls back
 * to the internal `/site/{siteId}` path. Independent of which domain served
 * the current request, so it's correct even via the `/site/{siteId}` fallback.
 */
export async function getCanonicalHostnameForSite(siteId: string): Promise<string | null> {
  try {
    const rows = await db
      .select({
        hostname: siteDomains.hostname,
        domainType: siteDomains.type,
        domainStatus: siteDomains.status,
        isPrimary: siteDomains.isPrimary,
        createdAt: siteDomains.createdAt,
      })
      .from(siteDomains)
      .where(and(eq(siteDomains.siteId, siteId), isNull(siteDomains.deletedAt)))
      .orderBy(asc(siteDomains.createdAt));

    return selectCanonicalHostname(rows);
  } catch (error) {
    logger.error("hosting.getCanonicalHostnameForSite failed", { siteId, err: error });
    return null;
  }
}
