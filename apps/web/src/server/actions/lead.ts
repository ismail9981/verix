"use server";

import { revalidatePath } from "next/cache";
import {
  convertLeadToCustomer,
  softDeleteLead,
  updateLeadStatus,
} from "../services/lead.service";
import { leadStatusUpdateSchema } from "../validators/lead";
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
