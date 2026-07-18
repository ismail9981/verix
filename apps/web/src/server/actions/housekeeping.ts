"use server";

import { revalidatePath } from "next/cache";
import {
  assignHousekeepingTask,
  cancelHousekeepingTask,
  completeHousekeepingTask,
  createHousekeepingTask,
  startHousekeepingTask,
  updateHousekeepingTask,
} from "../services/housekeeping.service";
import {
  housekeepingAssignInputSchema,
  housekeepingTaskInputSchema,
  housekeepingTaskNotesInputSchema,
} from "../validators/housekeeping";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for Housekeeping & Unit Operations — validate form data,
 * delegate to the service layer (which enforces RBAC and every workflow
 * invariant itself), map errors to a typed result, and revalidate the
 * Housekeeping pages. Never trust a client-supplied `workspaceId`, `role`, or
 * any foreign id — every id is re-validated inside the service layer.
 */

function parseInput(formData: FormData) {
  return housekeepingTaskInputSchema.safeParse({
    unitId: formData.get("unitId"),
    reservationId: formData.get("reservationId"),
    taskType: formData.get("taskType"),
    priority: formData.get("priority"),
    assignedTo: formData.get("assignedTo"),
    title: formData.get("title"),
    description: formData.get("description"),
    dueDate: formData.get("dueDate"),
    dueTime: formData.get("dueTime"),
    notes: formData.get("notes"),
  });
}

function revalidateHousekeepingPaths(taskId?: string) {
  revalidatePath("/housekeeping");
  revalidatePath("/dashboard");
  if (taskId) revalidatePath(`/housekeeping/${taskId}`);
}

export async function createHousekeepingTaskAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await createHousekeepingTask(workspaceId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("createHousekeepingTask", error);
    const message = error instanceof Error ? error.message : "Could not create the task.";
    return { status: "error", message };
  }

  revalidateHousekeepingPaths();
  return { status: "success", message: "Task created." };
}

export async function updateHousekeepingTaskAction(
  taskId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateHousekeepingTask(workspaceId, taskId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("updateHousekeepingTask", error);
    const message = error instanceof Error ? error.message : "Could not update the task.";
    return { status: "error", message };
  }

  revalidateHousekeepingPaths(taskId);
  return { status: "success", message: "Task updated." };
}

export async function assignHousekeepingTaskAction(
  taskId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = housekeepingAssignInputSchema.safeParse({
    assignedTo: formData.get("assignedTo"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await assignHousekeepingTask(workspaceId, taskId, parsed.data.assignedTo, { userId, role });
  } catch (error) {
    await logActionError("assignHousekeepingTask", error);
    const message = error instanceof Error ? error.message : "Could not assign the task.";
    return { status: "error", message };
  }

  revalidateHousekeepingPaths(taskId);
  return { status: "success", message: "Task assigned." };
}

export async function startHousekeepingTaskAction(
  taskId: string,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  try {
    await startHousekeepingTask(workspaceId, taskId, { userId, role });
  } catch (error) {
    await logActionError("startHousekeepingTask", error);
    const message = error instanceof Error ? error.message : "Could not start the task.";
    return { status: "error", message };
  }

  revalidateHousekeepingPaths(taskId);
  return { status: "success", message: "Task started." };
}

export async function completeHousekeepingTaskAction(
  taskId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = housekeepingTaskNotesInputSchema.safeParse({
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await completeHousekeepingTask(workspaceId, taskId, { userId, role }, parsed.data);
  } catch (error) {
    await logActionError("completeHousekeepingTask", error);
    const message = error instanceof Error ? error.message : "Could not complete the task.";
    return { status: "error", message };
  }

  revalidateHousekeepingPaths(taskId);
  return { status: "success", message: "Task completed." };
}

export async function cancelHousekeepingTaskAction(
  taskId: string,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  try {
    await cancelHousekeepingTask(workspaceId, taskId, { userId, role });
  } catch (error) {
    await logActionError("cancelHousekeepingTask", error);
    const message = error instanceof Error ? error.message : "Could not cancel the task.";
    return { status: "error", message };
  }

  revalidateHousekeepingPaths(taskId);
  return { status: "success", message: "Task cancelled." };
}
