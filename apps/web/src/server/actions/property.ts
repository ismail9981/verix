"use server";

import { revalidatePath } from "next/cache";
import {
  archiveProperty,
  createProperty,
  updateProperty,
} from "../services/property.service";
import { propertyInputSchema } from "../validators/property";
import { requireActiveWorkspaceCapability } from "../auth/authorize";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for property configuration (Sprint 12) — manager-or-owner
 * for create/edit, owner-only for archive (enforced inside the service).
 * Never trust a client-supplied `workspaceId`.
 */

function parseInput(formData: FormData) {
  return propertyInputSchema.safeParse({
    name: formData.get("name"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
    description: formData.get("description"),
  });
}

export async function createPropertyAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, role } =
    await requireActiveWorkspaceCapability("properties.manage");
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await createProperty(workspaceId, parsed.data, { role });
  } catch (error) {
    await logActionError("createProperty", error);
    const message =
      error instanceof Error ? error.message : "Could not create the property.";
    return { status: "error", message };
  }

  revalidatePath("/property-management");
  return { status: "success", message: "Property created." };
}

export async function updatePropertyAction(
  propertyId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, role } =
    await requireActiveWorkspaceCapability("properties.manage");
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateProperty(workspaceId, propertyId, parsed.data, { role });
  } catch (error) {
    await logActionError("updateProperty", error);
    const message =
      error instanceof Error ? error.message : "Could not update the property.";
    return { status: "error", message };
  }

  revalidatePath("/property-management");
  revalidatePath(`/property-management/${propertyId}`);
  return { status: "success", message: "Property updated." };
}

export async function archivePropertyAction(
  propertyId: string,
): Promise<FormActionResult> {
  const { workspaceId, role } =
    await requireActiveWorkspaceCapability("properties.archive");
  try {
    await archiveProperty(workspaceId, propertyId, { role });
  } catch (error) {
    await logActionError("archiveProperty", error);
    const message =
      error instanceof Error
        ? error.message
        : "Could not archive the property.";
    return { status: "error", message };
  }

  revalidatePath("/property-management");
  return { status: "success", message: "Property archived." };
}
