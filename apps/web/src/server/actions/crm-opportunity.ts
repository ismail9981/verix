"use server";

import { revalidatePath } from "next/cache";
import {
  archiveOpportunity,
  createOpportunity,
  markOpportunityLost,
  markOpportunityWon,
  moveOpportunityToStage,
  updateOpportunity,
} from "../services/crm-opportunity.service";
import {
  createOpportunitySchema,
  markOpportunityLostSchema,
  moveOpportunitySchema,
  updateOpportunitySchema,
  DUPLICATE_LEAD_OPPORTUNITY_ERROR,
} from "../validators/crm-pipeline";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { AuthorizationError } from "../auth/rbac";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for CRM opportunities.
 *
 * RBAC: any active workspace member (owner/manager/employee) may create,
 * update, move, and close opportunities — deliberately matching the
 * lead/customer actions' precedent (`getAuthorizedWorkspace()` only, no role
 * gate at this layer). The employee-only restriction ("act only on
 * opportunities assigned to you") is enforced *inside* the service
 * (`assertCanAccessOpportunity`), because it depends on the opportunity row's
 * `assignedToUserId`, which only the service has loaded.
 */

const PIPELINE_PATH = "/crm/pipeline";
const CRM_PATH = "/crm";

function friendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof Error && error.message === DUPLICATE_LEAD_OPPORTUNITY_ERROR) {
    return "This lead already has an open opportunity — move that one instead of creating a duplicate.";
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function createOpportunityAction(formData: FormData): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = createOpportunitySchema.safeParse({
    title: formData.get("title"),
    valueCents: formData.get("valueCents"),
    pipelineId: formData.get("pipelineId"),
    stageId: formData.get("stageId"),
    leadId: formData.get("leadId"),
    customerId: formData.get("customerId"),
    assignedToUserId: formData.get("assignedToUserId"),
    expectedCloseDate: formData.get("expectedCloseDate"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await createOpportunity(workspaceId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("createOpportunity", error);
    return { status: "error", message: friendlyMessage(error, "Could not create the opportunity.") };
  }

  revalidatePath(PIPELINE_PATH);
  revalidatePath(CRM_PATH);
  return { status: "success", message: "Opportunity created." };
}

export async function updateOpportunityAction(
  opportunityId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = updateOpportunitySchema.safeParse({
    title: formData.get("title"),
    valueCents: formData.get("valueCents"),
    expectedCloseDate: formData.get("expectedCloseDate"),
    assignedToUserId: formData.get("assignedToUserId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateOpportunity(workspaceId, opportunityId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("updateOpportunity", error);
    return { status: "error", message: friendlyMessage(error, "Could not update the opportunity.") };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Opportunity updated." };
}

export async function moveOpportunityToStageAction(
  opportunityId: string,
  stageId: string,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = moveOpportunitySchema.safeParse({ stageId });
  if (!parsed.success) {
    return { status: "error", message: "Invalid stage." };
  }

  try {
    await moveOpportunityToStage(workspaceId, opportunityId, parsed.data.stageId, { userId, role });
  } catch (error) {
    await logActionError("moveOpportunityToStage", error);
    return { status: "error", message: friendlyMessage(error, "Could not move the opportunity.") };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Opportunity moved." };
}

export async function markOpportunityWonAction(opportunityId: string): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  try {
    await markOpportunityWon(workspaceId, opportunityId, { userId, role });
  } catch (error) {
    await logActionError("markOpportunityWon", error);
    return { status: "error", message: friendlyMessage(error, "Could not mark the opportunity won.") };
  }

  revalidatePath(PIPELINE_PATH);
  revalidatePath(CRM_PATH);
  return { status: "success", message: "Opportunity marked won." };
}

export async function markOpportunityLostAction(
  opportunityId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = markOpportunityLostSchema.safeParse({
    lossReason: formData.get("lossReason"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields." };
  }

  try {
    await markOpportunityLost(workspaceId, opportunityId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("markOpportunityLost", error);
    return { status: "error", message: friendlyMessage(error, "Could not mark the opportunity lost.") };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Opportunity marked lost." };
}

export async function archiveOpportunityAction(opportunityId: string): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  try {
    await archiveOpportunity(workspaceId, opportunityId, { userId, role });
  } catch (error) {
    await logActionError("archiveOpportunity", error);
    return { status: "error", message: friendlyMessage(error, "Could not archive the opportunity.") };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Opportunity archived." };
}
