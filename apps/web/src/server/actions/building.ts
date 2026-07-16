"use server";

import { revalidatePath } from "next/cache";
import {
  archiveBuilding,
  createBuilding,
  reorderBuildings,
  updateBuilding,
} from "../services/building.service";
import { buildingInputSchema, buildingReorderSchema } from "../validators/building";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for building configuration (Sprint 12) — manager-or-owner
 * for create/edit/reorder, owner-only for archive (enforced inside the
 * service). Never trust a client-supplied `workspaceId`.
 */

function parseInput(formData: FormData) {
  return buildingInputSchema.safeParse({ name: formData.get("name") });
}

export async function createBuildingAction(
  propertyId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, role } = await getAuthorizedWorkspace();
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await createBuilding(workspaceId, propertyId, parsed.data, { role });
  } catch (error) {
    await logActionError("createBuilding", error);
    const message = error instanceof Error ? error.message : "Could not create the building.";
    return { status: "error", message };
  }

  revalidatePath(`/property-management/${propertyId}`);
  return { status: "success", message: "Building created." };
}

export async function updateBuildingAction(
  propertyId: string,
  buildingId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, role } = await getAuthorizedWorkspace();
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateBuilding(workspaceId, propertyId, buildingId, parsed.data, { role });
  } catch (error) {
    await logActionError("updateBuilding", error);
    const message = error instanceof Error ? error.message : "Could not update the building.";
    return { status: "error", message };
  }

  revalidatePath(`/property-management/${propertyId}`);
  return { status: "success", message: "Building updated." };
}

export async function reorderBuildingsAction(
  propertyId: string,
  orderedIds: string[],
): Promise<FormActionResult> {
  const { workspaceId, role } = await getAuthorizedWorkspace();
  const parsed = buildingReorderSchema.safeParse({ orderedIds });
  if (!parsed.success) {
    return { status: "error", message: "Invalid ordering." };
  }

  try {
    await reorderBuildings(workspaceId, propertyId, parsed.data.orderedIds, { role });
  } catch (error) {
    await logActionError("reorderBuildings", error);
    const message = error instanceof Error ? error.message : "Could not reorder buildings.";
    return { status: "error", message };
  }

  revalidatePath(`/property-management/${propertyId}`);
  return { status: "success", message: "Buildings reordered." };
}

export async function archiveBuildingAction(
  propertyId: string,
  buildingId: string,
): Promise<FormActionResult> {
  const { workspaceId, role } = await getAuthorizedWorkspace();
  try {
    await archiveBuilding(workspaceId, propertyId, buildingId, { role });
  } catch (error) {
    await logActionError("archiveBuilding", error);
    const message = error instanceof Error ? error.message : "Could not archive the building.";
    return { status: "error", message };
  }

  revalidatePath(`/property-management/${propertyId}`);
  return { status: "success", message: "Building archived." };
}
