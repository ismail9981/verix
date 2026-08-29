"use server";

import { revalidatePath } from "next/cache";
import {
  createPayment,
  softDeletePayment,
  updatePayment,
} from "../services/payment.service";
import {
  DUPLICATE_PAID_ERROR,
  paymentInputSchema,
} from "../validators/payment";
import { requireActiveWorkspaceCapability } from "../auth/authorize";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for the Payments feature — validate form data, delegate to the
 * service layer, map errors (including the duplicate-paid guard) to a typed
 * result, and revalidate the Payments page.
 */

const DUPLICATE_MESSAGE =
  "A completed payment already exists for this booking.";

function isDuplicate(error: unknown): boolean {
  if (error instanceof Error && error.message === DUPLICATE_PAID_ERROR) {
    return true;
  }
  // Postgres unique_violation from the partial unique index.
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function parseInput(formData: FormData) {
  return paymentInputSchema.safeParse({
    bookingId: formData.get("bookingId"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    method: formData.get("method"),
    status: formData.get("status"),
    paidAt: formData.get("paidAt"),
    notes: formData.get("notes"),
  });
}

export async function createPaymentAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } =
    await requireActiveWorkspaceCapability("payments.manage");
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await createPayment(workspaceId, parsed.data);
  } catch (error) {
    if (isDuplicate(error)) {
      return { status: "error", message: DUPLICATE_MESSAGE };
    }
    await logActionError("createPayment", error);
    return { status: "error", message: "Could not record the payment." };
  }

  revalidatePath("/payments");
  return { status: "success", message: "Payment recorded." };
}

export async function updatePaymentAction(
  paymentId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } =
    await requireActiveWorkspaceCapability("payments.manage");
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updatePayment(workspaceId, paymentId, parsed.data);
  } catch (error) {
    if (isDuplicate(error)) {
      return { status: "error", message: DUPLICATE_MESSAGE };
    }
    await logActionError("updatePayment", error);
    return { status: "error", message: "Could not update the payment." };
  }

  revalidatePath("/payments");
  return { status: "success", message: "Payment updated." };
}

export async function deletePaymentAction(
  paymentId: string,
): Promise<FormActionResult> {
  const { workspaceId } =
    await requireActiveWorkspaceCapability("payments.manage");
  try {
    await softDeletePayment(workspaceId, paymentId);
  } catch (error) {
    await logActionError("deletePayment", error);
    return { status: "error", message: "Could not delete the payment." };
  }

  revalidatePath("/payments");
  return { status: "success", message: "Payment deleted." };
}
