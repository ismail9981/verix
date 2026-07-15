import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { crmOpportunities, customers, leads } from "../db/schema";
import { ensureDefaultPipeline } from "./crm-pipeline.service";
import { findOpenOpportunityForLead, DUPLICATE_LEAD_OPPORTUNITY_ERROR } from "../validators/crm-pipeline";
import { findDuplicateCustomerMatch } from "../validators/lead-public";

/*
 * Leads ↔ CRM pipeline integration (Sprint 10). Kept out of both
 * `lead.service.ts` and `crm-opportunity.service.ts` because it's a single
 * atomic operation spanning both tables — combining logic already covered by
 * `convertLeadToCustomer` (lead.service.ts) and `createOpportunity`
 * (crm-opportunity.service.ts) individually.
 *
 * `ensureDefaultPipeline` runs its own transaction and is deliberately called
 * *before* opening ours: nesting a second `db.transaction` inside this one
 * would try to check out a second pool connection while the first is still
 * held, which can hang when the pool is capped at 1 (the default on
 * serverless — see `db/db.ts`).
 */

export interface ConvertLeadWithOpportunityResult {
  customerId: string;
  customerCreated: boolean;
  opportunityId: string;
}

/**
 * Converts a lead to a customer (same duplicate policy as
 * `convertLeadToCustomer`: reuse by normalized email, then phone) and creates
 * an opportunity linked to both the lead and the resulting customer — one
 * transaction, so a lead can never end up "converted" without its
 * opportunity, or vice versa. Rejects if the lead already has an open
 * opportunity (same policy `createOpportunity` enforces standalone).
 */
export async function convertLeadToCustomerAndCreateOpportunity(
  workspaceId: string,
  leadId: string,
  actor: { userId: string; role: string },
): Promise<ConvertLeadWithOpportunityResult> {
  const pipeline = await ensureDefaultPipeline(workspaceId);
  const firstStage = [...pipeline.stages].sort((a, b) => a.position - b.position)[0];
  if (!firstStage) throw new Error("This pipeline has no stages.");

  return db.transaction(async (tx) => {
    const leadRows = await tx
      .select({
        id: leads.id,
        status: leads.status,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        subject: leads.subject,
      })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.workspaceId, workspaceId), isNull(leads.deletedAt)));
    const lead = leadRows[0];
    if (!lead) throw new Error("Lead not found.");
    if (lead.status === "converted") throw new Error("Lead is already converted.");

    const existingForLead = await tx
      .select({ id: crmOpportunities.id, leadId: crmOpportunities.leadId, status: crmOpportunities.status })
      .from(crmOpportunities)
      .where(
        and(
          eq(crmOpportunities.workspaceId, workspaceId),
          eq(crmOpportunities.leadId, leadId),
          isNull(crmOpportunities.deletedAt),
          isNull(crmOpportunities.archivedAt),
        ),
      );
    if (findOpenOpportunityForLead(existingForLead, leadId)) {
      throw new Error(DUPLICATE_LEAD_OPPORTUNITY_ERROR);
    }

    const candidates = await tx
      .select({ id: customers.id, email: customers.email, phone: customers.phone })
      .from(customers)
      .where(and(eq(customers.workspaceId, workspaceId), isNull(customers.deletedAt)));
    const match = findDuplicateCustomerMatch(candidates, { email: lead.email, phone: lead.phone });

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
      .where(eq(leads.id, leadId));

    const assignedToUserId = actor.role === "employee" ? actor.userId : null;
    const opportunity = await tx
      .insert(crmOpportunities)
      .values({
        workspaceId,
        pipelineId: pipeline.id,
        stageId: firstStage.id,
        leadId,
        customerId,
        assignedToUserId,
        title: lead.subject?.trim() || lead.name?.trim() || "New opportunity",
        valueCents: 0,
      })
      .returning({ id: crmOpportunities.id });

    return { customerId, customerCreated: !match, opportunityId: opportunity[0]!.id };
  });
}
