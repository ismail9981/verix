import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db/db";
import { customers, leads, sites } from "../db/schema";
import {
  findDuplicateCustomerMatch,
  isValidLeadStatusTransition,
  type LeadStatus,
} from "../validators/lead-public";
import type { LeadFilters, LeadListItem, LeadStats } from "../validators/lead";

/*
 * Leads service — reusable data access for a workspace's public-form leads.
 * Every query is scoped to `workspaceId` and excludes soft-deleted rows, the
 * same tenant-isolation pattern as `customer.service.ts`. `createLeadFromPublicSubmission`
 * is the one exception to "caller-provided workspaceId" — its caller (the
 * public route handler) has already resolved `workspaceId` itself from
 * trusted host/snapshot context, never from client input.
 */

export interface SiteWorkspaceContext {
  workspaceId: string;
  status: string;
}

/**
 * The minimal, trusted lookup the public submission route needs: does this
 * siteId exist, and what workspace/publish-status does it belong to. Not
 * scoped to a workspace (the caller doesn't know one yet — this is how it
 * finds out) — the same trust boundary `getPublishedSnapshot` already uses
 * for the public renderer.
 */
export async function getSiteWorkspaceContext(
  siteId: string,
): Promise<SiteWorkspaceContext | null> {
  const rows = await db
    .select({ workspaceId: sites.workspaceId, status: sites.status })
    .from(sites)
    .where(and(eq(sites.id, siteId), isNull(sites.deletedAt)));
  return rows[0] ?? null;
}

export interface CreateLeadInput {
  workspaceId: string;
  siteId: string;
  pagePath: string;
  sourceDomain: string | null;
  formKey: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string | null;
  ipHash: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}

const LIST_COLUMNS = {
  id: leads.id,
  siteId: leads.siteId,
  siteName: sites.name,
  pagePath: leads.pagePath,
  sourceDomain: leads.sourceDomain,
  formKey: leads.formKey,
  name: leads.name,
  email: leads.email,
  phone: leads.phone,
  subject: leads.subject,
  message: leads.message,
  status: leads.status,
  convertedCustomerId: leads.convertedCustomerId,
  createdAt: leads.createdAt,
};

export async function createLeadFromPublicSubmission(
  input: CreateLeadInput,
): Promise<{ id: string }> {
  const rows = await db
    .insert(leads)
    .values({
      workspaceId: input.workspaceId,
      siteId: input.siteId,
      pagePath: input.pagePath,
      sourceDomain: input.sourceDomain,
      formKey: input.formKey,
      name: input.name,
      email: input.email,
      phone: input.phone,
      subject: input.subject,
      message: input.message,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
      metadata: input.metadata,
    })
    .returning({ id: leads.id });
  return rows[0]!;
}

export async function listLeads(
  workspaceId: string,
  filters: LeadFilters,
): Promise<LeadListItem[]> {
  const where = [eq(leads.workspaceId, workspaceId), isNull(leads.deletedAt)];

  if (filters.status !== "all") where.push(eq(leads.status, filters.status));
  if (filters.siteId) where.push(eq(leads.siteId, filters.siteId));
  if (filters.from) where.push(gte(leads.createdAt, new Date(`${filters.from}T00:00:00.000Z`)));
  if (filters.to) where.push(lte(leads.createdAt, new Date(`${filters.to}T23:59:59.999Z`)));
  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push(
      or(
        ilike(leads.name, term),
        ilike(leads.email, term),
        ilike(leads.phone, term),
        ilike(leads.subject, term),
      )!,
    );
  }

  return db
    .select(LIST_COLUMNS)
    .from(leads)
    .innerJoin(sites, eq(sites.id, leads.siteId))
    .where(and(...where))
    .orderBy(desc(leads.createdAt));
}

export async function getLeadStats(workspaceId: string): Promise<LeadStats> {
  const rows = await db
    .select({ status: leads.status, count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.workspaceId, workspaceId), isNull(leads.deletedAt)))
    .groupBy(leads.status);

  const counts = new Map(rows.map((r) => [r.status, r.count]));
  const stats: LeadStats = {
    total: 0,
    new: counts.get("new") ?? 0,
    contacted: counts.get("contacted") ?? 0,
    qualified: counts.get("qualified") ?? 0,
    converted: counts.get("converted") ?? 0,
    archived: counts.get("archived") ?? 0,
    spam: counts.get("spam") ?? 0,
  };
  stats.total =
    stats.new + stats.contacted + stats.qualified + stats.converted + stats.archived + stats.spam;
  return stats;
}

/** `converted` is unreachable here by design — see `isValidLeadStatusTransition`. */
export async function updateLeadStatus(
  workspaceId: string,
  id: string,
  nextStatus: LeadStatus,
): Promise<void> {
  const current = (
    await db
      .select({ status: leads.status })
      .from(leads)
      .where(
        and(eq(leads.id, id), eq(leads.workspaceId, workspaceId), isNull(leads.deletedAt)),
      )
  )[0];
  if (!current) throw new Error("Lead not found.");

  if (!isValidLeadStatusTransition(current.status, nextStatus)) {
    throw new Error("Use convertLeadToCustomer to mark a lead converted.");
  }

  await db
    .update(leads)
    .set({ status: nextStatus })
    .where(and(eq(leads.id, id), eq(leads.workspaceId, workspaceId)));
}

export async function softDeleteLead(workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .update(leads)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(leads.id, id), eq(leads.workspaceId, workspaceId), isNull(leads.deletedAt)),
    )
    .returning({ id: leads.id });
  if (!rows[0]) throw new Error("Lead not found.");
}

export interface ConvertLeadResult {
  customerId: string;
  customerCreated: boolean;
}

/**
 * Atomically links (or creates) a customer for this lead, then marks the lead
 * converted — the lead can never be `converted` without a linked customer.
 * Duplicate policy: reuse an existing workspace customer matched by
 * normalized email, then normalized phone (see `findDuplicateCustomerMatch`);
 * otherwise create a new one from the lead's fields.
 */
export async function convertLeadToCustomer(
  workspaceId: string,
  id: string,
): Promise<ConvertLeadResult> {
  return db.transaction(async (tx) => {
    const lead = (
      await tx
        .select({
          id: leads.id,
          status: leads.status,
          name: leads.name,
          email: leads.email,
          phone: leads.phone,
        })
        .from(leads)
        .where(
          and(eq(leads.id, id), eq(leads.workspaceId, workspaceId), isNull(leads.deletedAt)),
        )
    )[0];
    if (!lead) throw new Error("Lead not found.");
    if (lead.status === "converted") throw new Error("Lead is already converted.");

    const candidates = await tx
      .select({ id: customers.id, email: customers.email, phone: customers.phone })
      .from(customers)
      .where(and(eq(customers.workspaceId, workspaceId), isNull(customers.deletedAt)));

    const match = findDuplicateCustomerMatch(candidates, {
      email: lead.email,
      phone: lead.phone,
    });

    const customerId =
      match?.id ??
      (
        await tx
          .insert(customers)
          .values({
            workspaceId,
            name: lead.name?.trim() || "New lead",
            email: lead.email,
            phone: lead.phone,
            status: "new",
          })
          .returning({ id: customers.id })
      )[0]!.id;

    await tx
      .update(leads)
      .set({ status: "converted", convertedCustomerId: customerId, convertedAt: new Date() })
      .where(eq(leads.id, id));

    return { customerId, customerCreated: !match };
  });
}
