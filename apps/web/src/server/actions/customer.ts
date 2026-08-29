"use server";

import { revalidatePath } from "next/cache";
import {
  createCustomer,
  softDeleteCustomer,
  updateCustomer,
} from "../services/customer.service";
import { customerInputSchema } from "../validators/customer";
import { requireActiveWorkspaceCapability } from "../auth/authorize";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for the CRM feature — validate form data, delegate to the
 * service layer, map errors to a typed result, and revalidate the CRM page.
 */

function parseInput(formData: FormData) {
  return customerInputSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
}

export async function createCustomerAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } =
    await requireActiveWorkspaceCapability("customers.create");
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await createCustomer(workspaceId, parsed.data);
  } catch (error) {
    await logActionError("createCustomer", error);
    return { status: "error", message: "Could not create the customer." };
  }

  revalidatePath("/crm");
  return { status: "success", message: "Customer created." };
}

export async function updateCustomerAction(
  customerId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } =
    await requireActiveWorkspaceCapability("customers.update");
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateCustomer(workspaceId, customerId, parsed.data);
  } catch (error) {
    await logActionError("updateCustomer", error);
    return { status: "error", message: "Could not update the customer." };
  }

  revalidatePath("/crm");
  return { status: "success", message: "Customer updated." };
}

export async function deleteCustomerAction(
  customerId: string,
): Promise<FormActionResult> {
  const { workspaceId } =
    await requireActiveWorkspaceCapability("customers.archive");
  try {
    await softDeleteCustomer(workspaceId, customerId);
  } catch (error) {
    await logActionError("deleteCustomer", error);
    return { status: "error", message: "Could not delete the customer." };
  }

  revalidatePath("/crm");
  return { status: "success", message: "Customer deleted." };
}
