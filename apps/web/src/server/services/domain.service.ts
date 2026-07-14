import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { siteDomains } from "../db/schema";
import { generateVerificationToken } from "../dns/token";
import { assertSiteInWorkspace } from "./website.service";
import {
  APP_DOMAIN,
  composeHostname,
  slugifyLabel,
  type CreateDomainInput,
  type DomainListItem,
} from "../validators/domain";

/*
 * Domain service. Every operation is workspace-scoped and ignores soft-deleted
 * rows; multi-step operations (delete-with-promotion, set-primary) run in a
 * transaction. Hostname uniqueness is enforced both here (a friendly pre-check)
 * and by the partial-unique index (the race backstop). Independent of the
 * publishing pipeline. DNS verification and SSL-readiness state (Sprint 7.2)
 * live in `domain-verification.service.ts`, which reuses `DOMAIN_SELECT`.
 */

/** Thrown when a hostname is already taken; the action maps it to a field error. */
export const DUPLICATE_DOMAIN_ERROR = "DUPLICATE_DOMAIN";

/** Shared select shape — every domain-returning query (this file and the verification service) uses it. */
export const DOMAIN_SELECT = {
  id: siteDomains.id,
  siteId: siteDomains.siteId,
  hostname: siteDomains.hostname,
  type: siteDomains.type,
  status: siteDomains.status,
  isPrimary: siteDomains.isPrimary,
  createdAt: siteDomains.createdAt,
  verificationToken: siteDomains.verificationToken,
  verificationMethod: siteDomains.verificationMethod,
  verificationError: siteDomains.verificationError,
  verificationAttemptedAt: siteDomains.verificationAttemptedAt,
  verifiedAt: siteDomains.verifiedAt,
  sslStatus: siteDomains.sslStatus,
  sslError: siteDomains.sslError,
  sslIssuedAt: siteDomains.sslIssuedAt,
};

export async function listDomains(
  workspaceId: string,
  siteId: string,
): Promise<DomainListItem[]> {
  return db
    .select(DOMAIN_SELECT)
    .from(siteDomains)
    .where(
      and(
        eq(siteDomains.workspaceId, workspaceId),
        eq(siteDomains.siteId, siteId),
        isNull(siteDomains.deletedAt),
      ),
    )
    .orderBy(desc(siteDomains.isPrimary), asc(siteDomains.createdAt));
}

/** Whether a live domain with this hostname already exists (any site/workspace). */
async function hostnameTaken(hostname: string): Promise<boolean> {
  const rows = await db
    .select({ id: siteDomains.id })
    .from(siteDomains)
    .where(and(eq(siteDomains.hostname, hostname), isNull(siteDomains.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

export async function createDomain(
  workspaceId: string,
  input: CreateDomainInput,
): Promise<DomainListItem> {
  await assertSiteInWorkspace(workspaceId, input.siteId);

  const hostname = composeHostname(input.type, input.value);
  if (await hostnameTaken(hostname)) throw new Error(DUPLICATE_DOMAIN_ERROR);

  // The first domain for a site becomes its primary automatically.
  const existing = await db
    .select({ id: siteDomains.id })
    .from(siteDomains)
    .where(
      and(
        eq(siteDomains.siteId, input.siteId),
        eq(siteDomains.workspaceId, workspaceId),
        isNull(siteDomains.deletedAt),
      ),
    )
    .limit(1);
  const isPrimary = existing.length === 0;
  // Subdomains are ours immediately; custom domains await verification (7.2).
  const status = input.type === "subdomain" ? "active" : "pending";
  // Custom domains get a verification token up front so instructions are
  // available the moment the domain appears in the panel.
  const isCustom = input.type === "custom";

  const rows = await db
    .insert(siteDomains)
    .values({
      workspaceId,
      siteId: input.siteId,
      hostname,
      type: input.type,
      status,
      isPrimary,
      verificationToken: isCustom ? generateVerificationToken() : null,
      verificationMethod: isCustom ? "txt" : null,
    })
    .returning(DOMAIN_SELECT);
  return rows[0]!;
}

/** Soft-delete a domain; if it was primary, promote the oldest remaining one. */
export async function deleteDomain(
  workspaceId: string,
  id: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const target = (
      await tx
        .select({ siteId: siteDomains.siteId, isPrimary: siteDomains.isPrimary })
        .from(siteDomains)
        .where(
          and(
            eq(siteDomains.id, id),
            eq(siteDomains.workspaceId, workspaceId),
            isNull(siteDomains.deletedAt),
          ),
        )
    )[0];
    if (!target) throw new Error("Domain not found.");

    await tx
      .update(siteDomains)
      .set({ deletedAt: new Date() })
      .where(eq(siteDomains.id, id));

    if (target.isPrimary) {
      const next = (
        await tx
          .select({ id: siteDomains.id })
          .from(siteDomains)
          .where(
            and(
              eq(siteDomains.siteId, target.siteId),
              eq(siteDomains.workspaceId, workspaceId),
              isNull(siteDomains.deletedAt),
            ),
          )
          .orderBy(asc(siteDomains.createdAt))
          .limit(1)
      )[0];
      if (next) {
        await tx
          .update(siteDomains)
          .set({ isPrimary: true })
          .where(eq(siteDomains.id, next.id));
      }
    }
  });
}

/** Make one domain the site's sole primary (transactional). */
export async function setPrimaryDomain(
  workspaceId: string,
  siteId: string,
  id: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const target = (
      await tx
        .select({ id: siteDomains.id })
        .from(siteDomains)
        .where(
          and(
            eq(siteDomains.id, id),
            eq(siteDomains.siteId, siteId),
            eq(siteDomains.workspaceId, workspaceId),
            isNull(siteDomains.deletedAt),
          ),
        )
    )[0];
    if (!target) throw new Error("Domain not found.");

    await tx
      .update(siteDomains)
      .set({ isPrimary: false })
      .where(
        and(
          eq(siteDomains.siteId, siteId),
          eq(siteDomains.workspaceId, workspaceId),
          isNull(siteDomains.deletedAt),
        ),
      );
    await tx
      .update(siteDomains)
      .set({ isPrimary: true })
      .where(eq(siteDomains.id, id));
  });
}

/*
 * Give a brand-new site its default `<slug>.verix.app` subdomain (unique,
 * primary, active). Idempotent — does nothing if the site already has a domain.
 * Best-effort at the call sites so site creation never fails on it.
 */
export async function ensureDefaultSubdomain(
  workspaceId: string,
  siteId: string,
  siteName: string,
): Promise<void> {
  const existing = await db
    .select({ id: siteDomains.id })
    .from(siteDomains)
    .where(
      and(
        eq(siteDomains.siteId, siteId),
        eq(siteDomains.workspaceId, workspaceId),
        isNull(siteDomains.deletedAt),
      ),
    )
    .limit(1);
  if (existing.length > 0) return;

  const base = slugifyLabel(siteName);
  let label = base;
  let n = 2;
  while (await hostnameTaken(`${label}.${APP_DOMAIN}`)) {
    label = `${base}-${n++}`;
  }

  await db.insert(siteDomains).values({
    workspaceId,
    siteId,
    hostname: `${label}.${APP_DOMAIN}`,
    type: "subdomain",
    status: "active",
    isPrimary: true,
  });
}
