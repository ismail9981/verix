"use server";

import { revalidatePath } from "next/cache";
import {
  createService,
  softDeleteService,
  updateService,
} from "../services/service.service";
import { serviceInputSchema } from "../validators/service";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import {
  zodFieldErrors,
  type FormActionResult,
} from "./action-result";

/*
 * Server Actions for the Services feature — the boundary that validates form
 * data, delegates to the service layer, maps errors to a typed result, and
 * revalidates the Business Profile page so the list reflects the change.
 */

function parseInput(formData: FormData) {
  return serviceInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    status: formData.get("status"),
  });
}

export async function createServiceAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await createService(workspaceId, parsed.data);
  } catch (error) {
    await logActionError("createService", error);
    return { status: "error", message: "Could not create the service." };
  }

  revalidatePath("/business-profile");
  return { status: "success", message: "Service created." };
}

export async function updateServiceAction(
  serviceId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateService(workspaceId, serviceId, parsed.data);
  } catch (error) {
    await logActionError("updateService", error);
    return { status: "error", message: "Could not update the service." };
  }

  revalidatePath("/business-profile");
  return { status: "success", message: "Service updated." };
}

export async function deleteServiceAction(
  serviceId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    await softDeleteService(workspaceId, serviceId);
  } catch (error) {
    await logActionError("deleteService", error);
    return { status: "error", message: "Could not delete the service." };
  }

  revalidatePath("/business-profile");
  return { status: "success", message: "Service deleted." };
}
