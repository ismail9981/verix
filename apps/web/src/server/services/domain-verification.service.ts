import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { siteDomains } from "../db/schema";
import { isSafeToResolve } from "../dns/hostname-safety";
import { nodeDnsResolver, resolveTxtOutcome } from "../dns/resolver";
import { generateVerificationToken } from "../dns/token";
import {
  decideVerificationOutcome,
  normalizeHostname,
  type DnsResolver,
} from "../dns/verification";
import { logger } from "../observability/logger";
import { rateLimit } from "../observability/rate-limit";
import {
  verificationRecordName,
  verificationRecordValue,
  type DomainListItem,
  type DomainStatus,
} from "../validators/domain";
import { DOMAIN_SELECT } from "./domain.service";

/*
 * DNS ownership verification for custom domains (Sprint 7.2). Thin, atomic
 * db shells around the pure decision logic in `../dns/verification` — that
 * split is what makes state transitions unit-testable without a database.
 * Never touches `ssl_status`: DNS success is not SSL readiness.
 */

export class DomainVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainVerificationError";
  }
}

const VERIFY_LIMIT = 5;
const VERIFY_WINDOW_MS = 5 * 60_000; // 5 attempts / 5 min, per user and per domain
const REGENERATE_LIMIT = 5;
const REGENERATE_WINDOW_MS = 60 * 60_000; // 5 regenerations / hour, per user and per domain

const RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";

function assertNotRateLimited(key: string, limit: number, windowMs: number): void {
  if (rateLimit(key, limit, windowMs).limited) {
    throw new DomainVerificationError(RATE_LIMIT_MESSAGE);
  }
}

interface ScopedCustomDomain {
  id: string;
  hostname: string;
  status: DomainStatus;
  verificationToken: string | null;
  verificationMethod: "txt" | "cname" | null;
  verifiedAt: Date | null;
}

/** Loads a domain scoped to the workspace+site, rejecting soft-deleted rows and non-custom types. */
async function loadCustomDomain(
  workspaceId: string,
  siteId: string,
  domainId: string,
): Promise<ScopedCustomDomain> {
  const rows = await db
    .select({
      id: siteDomains.id,
      hostname: siteDomains.hostname,
      type: siteDomains.type,
      status: siteDomains.status,
      verificationToken: siteDomains.verificationToken,
      verificationMethod: siteDomains.verificationMethod,
      verifiedAt: siteDomains.verifiedAt,
    })
    .from(siteDomains)
    .where(
      and(
        eq(siteDomains.id, domainId),
        eq(siteDomains.siteId, siteId),
        eq(siteDomains.workspaceId, workspaceId),
        isNull(siteDomains.deletedAt),
      ),
    )
    .limit(1);
  const domain = rows[0];
  if (!domain) throw new DomainVerificationError("Domain not found.");
  if (domain.type !== "custom") {
    throw new DomainVerificationError(
      "Automatic verix.app subdomains don't require verification.",
    );
  }
  return domain;
}

export interface VerificationInstructions {
  hostname: string;
  recordType: "txt";
  recordName: string;
  recordValue: string;
}

/** The DNS record instructions to show a custom domain's owner (generates a token if one doesn't exist yet). */
export async function getDomainVerificationInstructions(
  workspaceId: string,
  siteId: string,
  domainId: string,
): Promise<VerificationInstructions> {
  const domain = await loadCustomDomain(workspaceId, siteId, domainId);
  const hostname = normalizeHostname(domain.hostname);
  const token = domain.verificationToken ?? generateVerificationToken();

  if (!domain.verificationToken) {
    await db
      .update(siteDomains)
      .set({ verificationToken: token, verificationMethod: "txt" })
      .where(
        and(eq(siteDomains.id, domainId), eq(siteDomains.workspaceId, workspaceId)),
      );
  }

  return {
    hostname,
    recordType: "txt",
    recordName: verificationRecordName(hostname),
    recordValue: verificationRecordValue(token),
  };
}

export interface VerifyDomainParams {
  workspaceId: string;
  siteId: string;
  userId: string;
  domainId: string;
  requestId: string;
  /** Injected for tests; defaults to the real Node DNS resolver. */
  resolver?: DnsResolver;
}

/**
 * Checks the live DNS TXT record against the domain's stored token and
 * transitions status accordingly. Never marks `ssl_status` — DNS success is
 * not SSL readiness (no certificate provider is integrated this sprint).
 */
export async function verifyDomain(
  params: VerifyDomainParams,
): Promise<DomainListItem> {
  const {
    workspaceId,
    siteId,
    userId,
    domainId,
    requestId,
    resolver = nodeDnsResolver,
  } = params;

  assertNotRateLimited(`domain-verify:user:${userId}`, VERIFY_LIMIT, VERIFY_WINDOW_MS);
  assertNotRateLimited(
    `domain-verify:domain:${domainId}`,
    VERIFY_LIMIT,
    VERIFY_WINDOW_MS,
  );

  const domain = await loadCustomDomain(workspaceId, siteId, domainId);
  const hostname = normalizeHostname(domain.hostname);
  const token = domain.verificationToken ?? generateVerificationToken();
  const safety = isSafeToResolve(hostname);

  const decision = safety.safe
    ? decideVerificationOutcome(
        await resolveTxtOutcome(
          resolver,
          verificationRecordName(hostname),
          verificationRecordValue(token),
        ),
        domain.status,
      )
    : {
        status: "failed" as const,
        verified: false,
        verificationError: "This domain can't be verified.",
      };

  const now = new Date();
  const rows = await db
    .update(siteDomains)
    .set({
      status: decision.status,
      verificationError: decision.verificationError,
      verificationAttemptedAt: now,
      // A transient lookup failure never destroys a prior verified state or a
      // prior "definitely not verified" state — only a fresh match/not_found/
      // mismatch outcome updates verifiedAt.
      verifiedAt: decision.verified
        ? now
        : decision.status === domain.status
          ? domain.verifiedAt
          : null,
      verificationToken: token,
      verificationMethod: "txt",
    })
    .where(
      and(
        eq(siteDomains.id, domainId),
        eq(siteDomains.workspaceId, workspaceId),
        isNull(siteDomains.deletedAt),
      ),
    )
    .returning(DOMAIN_SELECT);

  const updated = rows[0];
  if (!updated) throw new DomainVerificationError("Domain not found.");

  logger.info("domain.verify", {
    requestId,
    workspaceId,
    domainId,
    safe: safety.safe,
    resultStatus: updated.status,
  });

  return updated;
}

export interface RegenerateTokenParams {
  workspaceId: string;
  siteId: string;
  userId: string;
  domainId: string;
  requestId: string;
}

/** Issues a new verification token, invalidating the previous one and resetting verification state. */
export async function regenerateVerificationToken(
  params: RegenerateTokenParams,
): Promise<DomainListItem> {
  const { workspaceId, siteId, userId, domainId, requestId } = params;

  assertNotRateLimited(
    `domain-regen:user:${userId}`,
    REGENERATE_LIMIT,
    REGENERATE_WINDOW_MS,
  );
  assertNotRateLimited(
    `domain-regen:domain:${domainId}`,
    REGENERATE_LIMIT,
    REGENERATE_WINDOW_MS,
  );

  await loadCustomDomain(workspaceId, siteId, domainId);

  const rows = await db
    .update(siteDomains)
    .set({
      verificationToken: generateVerificationToken(),
      verificationMethod: "txt",
      status: "pending",
      verifiedAt: null,
      verificationError: null,
      verificationAttemptedAt: null,
    })
    .where(
      and(
        eq(siteDomains.id, domainId),
        eq(siteDomains.siteId, siteId),
        eq(siteDomains.workspaceId, workspaceId),
        isNull(siteDomains.deletedAt),
      ),
    )
    .returning(DOMAIN_SELECT);

  const updated = rows[0];
  if (!updated) throw new DomainVerificationError("Domain not found.");

  logger.info("domain.regenerateVerificationToken", {
    requestId,
    workspaceId,
    domainId,
  });

  return updated;
}
