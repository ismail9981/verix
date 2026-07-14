import { describe, it, expect } from "vitest";
import {
  evaluateRoutingCandidate,
  isDomainRouteEligible,
  selectCanonicalHostname,
  type CanonicalCandidateRow,
  type RoutingCandidateRow,
} from "./site-resolver";

function row(overrides: Partial<RoutingCandidateRow> = {}): RoutingCandidateRow {
  return {
    domainId: "d1",
    siteId: "s1",
    hostname: "business.verix.app",
    domainType: "subdomain",
    domainStatus: "active",
    isPrimary: true,
    siteStatus: "published",
    publishedVersionId: "v1",
    domainDeletedAt: null,
    siteDeletedAt: null,
    ...overrides,
  };
}

describe("isDomainRouteEligible", () => {
  it("requires active for subdomains", () => {
    expect(isDomainRouteEligible("subdomain", "active")).toBe(true);
    expect(isDomainRouteEligible("subdomain", "pending")).toBe(false);
    expect(isDomainRouteEligible("subdomain", "verified")).toBe(false);
    expect(isDomainRouteEligible("subdomain", "failed")).toBe(false);
  });

  it("requires verified for custom domains (never reaches active)", () => {
    expect(isDomainRouteEligible("custom", "verified")).toBe(true);
    expect(isDomainRouteEligible("custom", "active")).toBe(false);
    expect(isDomainRouteEligible("custom", "pending")).toBe(false);
    expect(isDomainRouteEligible("custom", "failed")).toBe(false);
  });
});

describe("evaluateRoutingCandidate", () => {
  it("returns null when there is no row (unknown host)", () => {
    expect(evaluateRoutingCandidate(undefined)).toBeNull();
  });

  it("resolves an active automatic subdomain on a published site", () => {
    const dto = evaluateRoutingCandidate(row());
    expect(dto).toEqual({
      siteId: "s1",
      domainId: "d1",
      hostname: "business.verix.app",
      isPrimary: true,
      siteStatus: "published",
    });
  });

  it("resolves a verified custom domain on a published site", () => {
    const dto = evaluateRoutingCandidate(
      row({ domainType: "custom", domainStatus: "verified", hostname: "biz.com" }),
    );
    expect(dto?.hostname).toBe("biz.com");
  });

  it("rejects a pending custom domain", () => {
    expect(
      evaluateRoutingCandidate(row({ domainType: "custom", domainStatus: "pending" })),
    ).toBeNull();
  });

  it("rejects a failed custom domain", () => {
    expect(
      evaluateRoutingCandidate(row({ domainType: "custom", domainStatus: "failed" })),
    ).toBeNull();
  });

  it("rejects a soft-deleted domain (defense in depth beyond the SQL filter)", () => {
    expect(evaluateRoutingCandidate(row({ domainDeletedAt: new Date() }))).toBeNull();
  });

  it("rejects a domain on a soft-deleted site", () => {
    expect(evaluateRoutingCandidate(row({ siteDeletedAt: new Date() }))).toBeNull();
  });

  it("rejects an unpublished site", () => {
    expect(
      evaluateRoutingCandidate(row({ siteStatus: "draft", publishedVersionId: null })),
    ).toBeNull();
    expect(evaluateRoutingCandidate(row({ siteStatus: "unpublished" }))).toBeNull();
  });

  it("rejects a published-status site with no publishedVersionId", () => {
    expect(
      evaluateRoutingCandidate(row({ siteStatus: "published", publishedVersionId: null })),
    ).toBeNull();
  });

  it("never leaks workspace data in the DTO", () => {
    const dto = evaluateRoutingCandidate(row());
    expect(dto).not.toHaveProperty("workspaceId");
  });
});

function canonicalRow(overrides: Partial<CanonicalCandidateRow> = {}): CanonicalCandidateRow {
  return {
    hostname: "business.verix.app",
    domainType: "subdomain",
    domainStatus: "active",
    isPrimary: true,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("selectCanonicalHostname", () => {
  it("returns null when there are no eligible domains", () => {
    expect(selectCanonicalHostname([])).toBeNull();
    expect(
      selectCanonicalHostname([canonicalRow({ domainStatus: "pending", domainType: "custom" })]),
    ).toBeNull();
  });

  it("prefers the primary domain even if it was created later", () => {
    const primary = canonicalRow({
      hostname: "primary.com",
      domainType: "custom",
      domainStatus: "verified",
      isPrimary: true,
      createdAt: new Date("2026-02-01"),
    });
    const other = canonicalRow({
      hostname: "other.verix.app",
      isPrimary: false,
      createdAt: new Date("2026-01-01"),
    });
    expect(selectCanonicalHostname([other, primary])).toBe("primary.com");
  });

  it("falls back to the oldest eligible non-primary domain when primary is ineligible", () => {
    const ineligiblePrimary = canonicalRow({
      hostname: "primary.com",
      domainType: "custom",
      domainStatus: "pending",
      isPrimary: true,
    });
    const older = canonicalRow({
      hostname: "older.verix.app",
      isPrimary: false,
      createdAt: new Date("2026-01-01"),
    });
    const newer = canonicalRow({
      hostname: "newer.verix.app",
      isPrimary: false,
      createdAt: new Date("2026-03-01"),
    });
    expect(selectCanonicalHostname([newer, ineligiblePrimary, older])).toBe(
      "older.verix.app",
    );
  });
});
