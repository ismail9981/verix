"use server";

import { revalidatePath } from "next/cache";
import {
  convertLeadToCustomer,
  getLeadById,
  softDeleteLead,
  updateLeadStatus,
} from "../services/lead.service";
import { convertLeadToCustomerAndCreateOpportunity } from "../services/crm-lead-integration.service";
import { createOpportunity } from "../services/crm-opportunity.service";
import { ensureDefaultPipeline } from "../services/crm-pipeline.service";
import { leadStatusUpdateSchema } from "../validators/lead";
import { DUPLICATE_LEAD_OPPORTUNITY_ERROR } from "../validators/crm-pipeline";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for the dashboard Leads module.
 *
 * RBAC: any active workspace member (owner/manager/employee) may manage
 * leads — deliberately matching the CRM/customer actions' precedent
 * (`customer.ts` calls only `getAuthorizedWorkspace()`, no role gate), since
 * leads are a CRM-adjacent, non-administrative resource. This is a decision,
 * not an oversight: owner-only gating (via `requireOwner()`) is reserved in
 * this codebase for administrative actions (team, billing, domains).
 */

export async function updateLeadStatusAction(
  leadId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = leadStatusUpdateSchema.safeParse({
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please choose a valid status.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateLeadStatus(workspaceId, leadId, parsed.data.status);
  } catch (error) {
    await logActionError("updateLeadStatus", error);
    return { status: "error", message: "Could not update the lead." };
  }

  revalidatePath("/leads");
  return { status: "success", message: "Lead updated." };
}

export async function deleteLeadAction(leadId: string): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    await softDeleteLead(workspaceId, leadId);
  } catch (error) {
    await logActionError("deleteLead", error);
    return { status: "error", message: "Could not delete the lead." };
  }

  revalidatePath("/leads");
  return { status: "success", message: "Lead deleted." };
}

export async function convertLeadToCustomerAction(
  leadId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    const result = await convertLeadToCustomer(workspaceId, leadId);
    revalidatePath("/leads");
    revalidatePath("/crm");
    return {
      status: "success",
      message: result.customerCreated
        ? "Lead converted to a new customer."
        : "Lead linked to an existing customer.",
    };
  } catch (error) {
    await logActionError("convertLeadToCustomer", error);
    return { status: "error", message: "Could not convert the lead." };
  }
}

/**
 * CRM pipeline integration (Sprint 10). Creates an opportunity linked to this
 * lead without converting it to a customer — the lead's status is untouched,
 * matching the "backward compatible with Sprint 9" requirement (nothing about
 * the existing lead lifecycle changes).
 */
export async function createOpportunityFromLeadAction(
  leadId: string,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  try {
    const lead = await getLeadById(workspaceId, leadId);
    if (!lead) return { status: "error", message: "Lead not found." };

    const pipeline = await ensureDefaultPipeline(workspaceId);
    await createOpportunity(
      workspaceId,
      {
        title: lead.subject?.trim() || lead.name?.trim() || "New opportunity",
        valueCents: 0,
        pipelineId: pipeline.id,
        leadId,
      },
      { userId, role },
    );
  } catch (error) {
    await logActionError("createOpportunityFromLead", error);
    const message =
      error instanceof Error && error.message === DUPLICATE_LEAD_OPPORTUNITY_ERROR
        ? "This lead already has an open opportunity."
        : "Could not create an opportunity from this lead.";
    return { status: "error", message };
  }

  revalidatePath("/leads");
  revalidatePath("/crm/pipeline");
  return { status: "success", message: "Opportunity created from lead." };
}

/** Converts the lead to a customer and creates its opportunity in one transaction — see `convertLeadToCustomerAndCreateOpportunity`. */
export async function convertLeadToCustomerAndOpportunityAction(
  leadId: string,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  try {
    const result = await convertLeadToCustomerAndCreateOpportunity(workspaceId, leadId, {
      userId,
      role,
    });
    revalidatePath("/leads");
    revalidatePath("/crm");
    revalidatePath("/crm/pipeline");
    return {
      status: "success",
      message: result.customerCreated
        ? "Lead converted to a new customer with an opportunity."
        : "Lead linked to an existing customer with a new opportunity.",
    };
  } catch (error) {
    await logActionError("convertLeadToCustomerAndOpportunity", error);
    const message =
      error instanceof Error && error.message === DUPLICATE_LEAD_OPPORTUNITY_ERROR
        ? "This lead already has an open opportunity."
        : "Could not convert the lead.";
    return { status: "error", message };
  }
}
