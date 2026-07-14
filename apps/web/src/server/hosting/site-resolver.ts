import type { DomainStatus, DomainType } from "../validators/domain";
import type { SiteStatus } from "../validators/website";

/*
 * Pure eligibility/decision logic for host-based site routing (Sprint 7.3).
 * No db — `site-resolver.service.ts` supplies raw joined rows; this module
 * only classifies and decides, mirroring `dns/verification.ts`'s split so the
 * business rules are unit-testable without a database.
 */

/**
 * Whether a domain's (type, status) pair is eligible to serve traffic.
 * Automatic `<label>.verix.app` subdomains go straight to `active` on
 * creation (`domain.service.ts`); custom domains never reach `active` — DNS
 * verification success only takes them to `verified` (`domain-verification
 * .service.ts` never sets `ssl_status`-gated `active`). Reflects that split.
 */
export function isDomainRouteEligible(type: DomainType, status: DomainStatus): boolean {
  return type === "subdomain" ? status === "active" : status === "verified";
}

/** The raw joined `site_domains` ⋈ `sites` row the service query produces. */
export interface RoutingCandidateRow {
  domainId: string;
  siteId: string;
  hostname: string;
  domainType: DomainType;
  domainStatus: DomainStatus;
  isPrimary: boolean;
  siteStatus: SiteStatus;
  publishedVersionId: string | null;
  /**
   * Defense-in-depth: the service's SQL `WHERE` already excludes soft-deleted
   * rows, but this function re-checks them so the rule is unit-testable on
   * its own and survives a future regression in that filter.
   */
  domainDeletedAt: Date | null;
  siteDeletedAt: Date | null;
}

/** The lean, public-safe DTO returned to the proxy — never workspace data. */
export interface SiteRouteDTO {
  siteId: string;
  domainId: string;
  hostname: string;
  isPrimary: boolean;
  siteStatus: "published";
}

/**
 * Applies publish-state and domain-eligibility rules to a raw candidate row.
 * Soft-delete filtering happens in the service's SQL `WHERE` (defense in
 * depth + keeps the unique-hostname index usable); this function only decides
 * business eligibility on rows that already passed that filter.
 */
export function evaluateRoutingCandidate(
  row: RoutingCandidateRow | undefined,
): SiteRouteDTO | null {
  if (!row) return null;
  if (row.domainDeletedAt || row.siteDeletedAt) return null;
  if (row.siteStatus !== "published" || !row.publishedVersionId) return null;
  if (!isDomainRouteEligible(row.domainType, row.domainStatus)) return null;

  return {
    siteId: row.siteId,
    domainId: row.domainId,
    hostname: row.hostname,
    isPrimary: row.isPrimary,
    siteStatus: "published",
  };
}

/** A candidate row for canonical-hostname selection (no site-status fields needed). */
export interface CanonicalCandidateRow {
  hostname: string;
  domainType: DomainType;
  domainStatus: DomainStatus;
  isPrimary: boolean;
  createdAt: Date;
}

/**
 * Picks the best eligible hostname to use as a site's canonical URL: the
 * primary domain if it's eligible, else the oldest other eligible domain
 * (same tie-break order as `domain.service.ts`'s `listDomains`), else null
 * (caller falls back to the internal `/site/{siteId}` path).
 */
export function selectCanonicalHostname(
  rows: readonly CanonicalCandidateRow[],
): string | null {
  const eligible = rows.filter((r) => isDomainRouteEligible(r.domainType, r.domainStatus));
  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return sorted[0]!.hostname;
}
