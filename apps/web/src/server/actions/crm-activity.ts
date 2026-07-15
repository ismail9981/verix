"use server";

import { revalidatePath } from "next/cache";
import {
  addActivity,
  completeActivity,
  deleteActivity,
  listOpportunityActivities,
  updateActivity,
  type ActivityDto,
} from "../services/crm-activity.service";
import { createActivitySchema, updateActivitySchema } from "../validators/crm-activity";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { AuthorizationError } from "../auth/rbac";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for an opportunity's activities/follow-ups.
 *
 * RBAC: any active workspace member may manage activities on an opportunity
 * they can access — `getAuthorizedWorkspace()` only, same precedent as
 * `crm-opportunity.ts`. The employee-only restriction is enforced inside the
 * service, which loads the parent opportunity's `assignedToUserId` before
 * allowing the read/write.
 */

const PIPELINE_PATH = "/crm/pipeline";

function friendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

/** On-demand fetch for the opportunity drawer (loaded when it opens, not preloaded for every card on the board). */
export async function listOpportunityActivitiesAction(
  opportunityId: string,
): Promise<ActivityDto[]> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  return listOpportunityActivities(workspaceId, opportunityId, { userId, role });
}

export async function addActivityAction(
  opportunityId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = createActivitySchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    body: formData.get("body"),
    dueAt: formData.get("dueAt"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await addActivity(workspaceId, opportunityId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("addActivity", error);
    return { status: "error", message: friendlyMessage(error, "Could not add the activity.") };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Activity added." };
}

export async function updateActivityAction(
  activityId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = updateActivitySchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    dueAt: formData.get("dueAt"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateActivity(workspaceId, activityId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("updateActivity", error);
    return { status: "error", message: friendlyMessage(error, "Could not update the activity.") };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Activity updated." };
}

export async function completeActivityAction(activityId: string): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  try {
    await completeActivity(workspaceId, activityId, { userId, role });
  } catch (error) {
    await logActionError("completeActivity", error);
    return { status: "error", message: friendlyMessage(error, "Could not complete the activity.") };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Activity completed." };
}

export async function deleteActivityAction(activityId: string): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  try {
    await deleteActivity(workspaceId, activityId, { userId, role });
  } catch (error) {
    await logActionError("deleteActivity", error);
    return { status: "error", message: friendlyMessage(error, "Could not delete the activity.") };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Activity deleted." };
}
