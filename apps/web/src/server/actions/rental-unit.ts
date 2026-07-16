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
 * Server Actions for rental unit configuration — owner-only (enforced inside
 * the service, since role gating there is the single source of truth used by
 * both this action and any future caller). Never trust a client-supplied
 * `workspaceId`.
 */

function parseInput(formData: FormData) {
  return rentalUnitInputSchema.safeParse({
    name: formData.get("name"),
    unitType: formData.get("unitType"),
    description: formData.get("description"),
    capacity: formData.get("capacity"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
}

export async function createRentalUnitAction(
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
    await createRentalUnit(workspaceId, parsed.data, { role });
  } catch (error) {
    await logActionError("createRentalUnit", error);
    const message = error instanceof Error ? error.message : "Could not create the unit.";
    return { status: "error", message };
  }

  revalidatePath("/reservations");
  return { status: "success", message: "Unit created." };
}

export async function updateRentalUnitAction(
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

  revalidatePath("/reservations");
  return { status: "success", message: "Unit updated." };
}

export async function deleteRentalUnitAction(unitId: string): Promise<FormActionResult> {
  const { workspaceId, role } = await getAuthorizedWorkspace();
  try {
    await softDeleteRentalUnit(workspaceId, unitId, { role });
  } catch (error) {
    await logActionError("deleteRentalUnit", error);
    const message = error instanceof Error ? error.message : "Could not delete the unit.";
    return { status: "error", message };
  }

  revalidatePath("/reservations");
  return { status: "success", message: "Unit deleted." };
}
