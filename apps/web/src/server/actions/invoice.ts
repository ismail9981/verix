"use server";

import type { z } from "zod";
import { getAuthorizedWorkspace } from "../auth/workspace";
import {
  recordPayment,
  recordRefund,
  voidPayment,
} from "../services/invoice.service";
import {
  recordPaymentInputSchema,
  recordRefundInputSchema,
  voidPaymentInputSchema,
} from "../validators/invoice";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for the billing ledger (Sprint 16). RBAC here is entirely
 * data-dependent — `assertInvoiceActionAllowed`/`assertCanAccessInvoice`
 * inside `invoice.service.ts` already enforce it, enumeration-safely — so,
 * matching the crm-opportunity precedent, this layer adds no role gate of
 * its own: `getAuthorizedWorkspace()` only, then defer to the service for
 * both authorization and existence.
 *
 * No cache revalidation yet: no current page renders invoice/payment-derived
 * state from a cache (the only consumer, `/analytics`, is `force-dynamic`).
 * Revalidation targets belong to the future Billing UI phase.
 */

const IDEMPOTENCY_RETRY_MESSAGE =
  "Something went wrong preparing this request. Please try again.";

function friendlyMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * `idempotencyKey` is a hidden, caller-generated field with no visible form
 * control — a missing/empty value is a caller bug, not something the user
 * can fix, so it must never surface as a `fieldErrors.idempotencyKey` entry
 * pointing at an invisible field. Any other, genuinely visible field issues
 * still map through `zodFieldErrors` as normal.
 */
function invalidInputResult(error: z.ZodError): FormActionResult {
  const fieldErrors = zodFieldErrors(error);
  const visibleFieldErrors = Object.fromEntries(
    Object.entries(fieldErrors).filter(([field]) => field !== "idempotencyKey"),
  );
  if (Object.keys(visibleFieldErrors).length === 0) {
    return { status: "error", message: IDEMPOTENCY_RETRY_MESSAGE };
  }
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors: visibleFieldErrors,
  };
}

export async function recordPaymentAction(
  invoiceId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = recordPaymentInputSchema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    idempotencyKey: formData.get("idempotencyKey"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return invalidInputResult(parsed.error);

  try {
    await recordPayment(workspaceId, invoiceId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("recordPayment", error);
    return {
      status: "error",
      message: friendlyMessage(error, "Could not record the payment."),
    };
  }

  return { status: "success", message: "Payment recorded." };
}

export async function recordRefundAction(
  invoiceId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = recordRefundInputSchema.safeParse({
    chargePaymentId: formData.get("chargePaymentId"),
    amount: formData.get("amount"),
    idempotencyKey: formData.get("idempotencyKey"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return invalidInputResult(parsed.error);

  try {
    await recordRefund(workspaceId, invoiceId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("recordRefund", error);
    return {
      status: "error",
      message: friendlyMessage(error, "Could not record the refund."),
    };
  }

  return { status: "success", message: "Refund recorded." };
}

export async function voidPaymentAction(
  paymentId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = voidPaymentInputSchema.safeParse({
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await voidPayment(workspaceId, paymentId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("voidPayment", error);
    return {
      status: "error",
      message: friendlyMessage(error, "Could not void the payment."),
    };
  }

  return { status: "success", message: "Payment voided." };
}
