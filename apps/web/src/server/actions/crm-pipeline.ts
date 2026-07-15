"use server";

import { revalidatePath } from "next/cache";
import {
  createPipeline,
  createStage,
  deletePipeline,
  deleteStage,
  reorderPipelineStages,
  updateStage,
} from "../services/crm-pipeline.service";
import {
  createPipelineSchema,
  createStageSchema,
  reorderStagesSchema,
  updateStageSchema,
} from "../validators/crm-pipeline";
import { requireManagerOrAbove, requireOwner } from "../auth/authorize";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for CRM pipeline/stage configuration.
 *
 * RBAC: creating a pipeline, creating a stage, and reordering stages require
 * manager-or-owner (`requireManagerOrAbove`). Deleting a pipeline is always
 * owner-only. Renaming or deleting a *protected* (system-provisioned) stage
 * additionally requires owner — that check lives inside
 * `updateStage`/`deleteStage` themselves (`assertCanMutateStage`), since only
 * the service has loaded the stage's `isProtected` flag; here we only assert
 * the manager-or-owner floor before calling in.
 */

const PIPELINE_PATH = "/crm/pipeline";

export async function createPipelineAction(formData: FormData): Promise<FormActionResult> {
  const { workspaceId } = await requireManagerOrAbove();
  const parsed = createPipelineSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please enter a valid pipeline name.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await createPipeline(workspaceId, parsed.data);
  } catch (error) {
    await logActionError("createPipeline", error);
    return { status: "error", message: "Could not create the pipeline." };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Pipeline created." };
}

export async function deletePipelineAction(pipelineId: string): Promise<FormActionResult> {
  const { workspaceId } = await requireOwner();
  try {
    await deletePipeline(workspaceId, pipelineId);
  } catch (error) {
    await logActionError("deletePipeline", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not delete the pipeline.",
    };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Pipeline deleted." };
}

export async function createStageAction(
  pipelineId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await requireManagerOrAbove();
  const parsed = createStageSchema.safeParse({
    name: formData.get("name"),
    probabilityPercent: formData.get("probabilityPercent"),
    tone: formData.get("tone"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await createStage(workspaceId, pipelineId, parsed.data);
  } catch (error) {
    await logActionError("createStage", error);
    return { status: "error", message: "Could not create the stage." };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Stage created." };
}

export async function updateStageAction(
  stageId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, role } = await requireManagerOrAbove();
  const parsed = updateStageSchema.safeParse({
    name: formData.get("name"),
    probabilityPercent: formData.get("probabilityPercent"),
    tone: formData.get("tone"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateStage(workspaceId, stageId, parsed.data, { role });
  } catch (error) {
    await logActionError("updateStage", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not update the stage.",
    };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Stage updated." };
}

export async function deleteStageAction(stageId: string): Promise<FormActionResult> {
  const { workspaceId, role } = await requireManagerOrAbove();
  try {
    await deleteStage(workspaceId, stageId, { role });
  } catch (error) {
    await logActionError("deleteStage", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not delete the stage.",
    };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Stage deleted." };
}

export async function reorderStagesAction(
  pipelineId: string,
  stageIds: string[],
): Promise<FormActionResult> {
  const { workspaceId } = await requireManagerOrAbove();
  const parsed = reorderStagesSchema.safeParse({ stageIds });
  if (!parsed.success) {
    return { status: "error", message: "Invalid stage order." };
  }

  try {
    await reorderPipelineStages(workspaceId, pipelineId, parsed.data.stageIds);
  } catch (error) {
    await logActionError("reorderPipelineStages", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not reorder stages.",
    };
  }

  revalidatePath(PIPELINE_PATH);
  return { status: "success", message: "Stages reordered." };
}
