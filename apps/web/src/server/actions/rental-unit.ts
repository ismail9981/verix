"use server";

import { revalidatePath } from "next/cache";
import {
  createRentalUnit,
  softDeleteRentalUnit,
  updateRentalUnit,
} from "../services/rental-unit.service";
import { rentalUnitInputSchema } from "../validators/rental-unit";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for rental unit configuration (Sprint 12) — manager-or-owner
 * for create/edit, owner-only for delete (enforced inside the service, since
 * role gating there is the single source of truth used by both this action
 * and any future caller). Never trust a client-supplied `workspaceId`.
 * Placement (`propertyId`/`buildingId`) comes from the route the unit is
 * managed from, not the form body — see `rental-unit.service.ts`'s module
 * doc comment.
 */

function parseInput(formData: FormData) {
  return rentalUnitInputSchema.safeParse({
    name: formData.get("name"),
    unitNumber: formData.get("unitNumber"),
    floor: formData.get("floor"),
    unitType: formData.get("unitType"),
    description: formData.get("description"),
    capacity: formData.get("capacity"),
    bedrooms: formData.get("bedrooms"),
    bathrooms: formData.get("bathrooms"),
    sizeSqFt: formData.get("sizeSqFt"),
    amenities: formData.get("amenities"),
    notes: formData.get("notes"),
    amount: formData.get("amount"),
    statusOverride: formData.get("statusOverride"),
  });
}

function revalidateUnitPaths(propertyId: string, buildingId: string) {
  revalidatePath(`/property-management/${propertyId}/${buildingId}`);
  revalidatePath("/property-management");
  // The reservation form's unit selector reads from this feature too.
  revalidatePath("/reservations");
  revalidatePath("/reservations/new");
}

export async function createRentalUnitAction(
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
    await createRentalUnit(workspaceId, propertyId, buildingId, parsed.data, { role });
  } catch (error) {
    await logActionError("createRentalUnit", error);
    const message = error instanceof Error ? error.message : "Could not create the unit.";
    return { status: "error", message };
  }

  revalidateUnitPaths(propertyId, buildingId);
  return { status: "success", message: "Unit created." };
}

export async function updateRentalUnitAction(
  propertyId: string,
  buildingId: string,
  unitId: string,
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
    await updateRentalUnit(workspaceId, unitId, parsed.data, { role });
  } catch (error) {
    await logActionError("updateRentalUnit", error);
    const message = error instanceof Error ? error.message : "Could not update the unit.";
    return { status: "error", message };
  }

  revalidateUnitPaths(propertyId, buildingId);
  return { status: "success", message: "Unit updated." };
}

export async function deleteRentalUnitAction(
  propertyId: string,
  buildingId: string,
  unitId: string,
): Promise<FormActionResult> {
  const { workspaceId, role } = await getAuthorizedWorkspace();
  try {
    await softDeleteRentalUnit(workspaceId, unitId, { role });
  } catch (error) {
    await logActionError("deleteRentalUnit", error);
    const message = error instanceof Error ? error.message : "Could not delete the unit.";
    return { status: "error", message };
  }

  revalidateUnitPaths(propertyId, buildingId);
  return { status: "success", message: "Unit deleted." };
}
