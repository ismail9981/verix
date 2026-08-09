"use server";

import { revalidatePath } from "next/cache";
import {
  createReservation,
  softDeleteReservation,
  updateReservation,
  updateReservationStatus,
} from "../services/reservation.service";
import {
  reservationInputSchema,
  reservationStatusInputSchema,
  RESERVATION_STATUSES,
} from "../validators/reservation";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for the Reservations feature — validate form data, delegate
 * to the service layer, map errors to a typed result, and revalidate the
 * Reservations pages. Never trust a client-supplied `workspaceId`.
 */

function parseInput(formData: FormData) {
  return reservationInputSchema.safeParse({
    unitId: formData.get("unitId"),
    customerId: formData.get("customerId"),
    staffId: formData.get("staffId"),
    checkInDate: formData.get("checkInDate"),
    checkOutDate: formData.get("checkOutDate"),
    amount: formData.get("amount"),
    source: formData.get("source"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
}

function revalidateReservationPaths() {
  revalidatePath("/reservations");
  revalidatePath("/reservations/calendar");
  // Sprint 18: the dashboard's reservations trend/snapshot/occupancy/
  // activity-timeline widgets are sourced from this same reservations
  // table, matching `housekeeping.ts`'s identical precedent.
  revalidatePath("/dashboard");
}

export async function createReservationAction(
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
    await createReservation(workspaceId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("createReservation", error);
    const message =
      error instanceof Error ? error.message : "Could not create the reservation.";
    return { status: "error", message };
  }

  revalidateReservationPaths();
  return { status: "success", message: "Reservation created." };
}

export async function updateReservationAction(
  reservationId: string,
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
    await updateReservation(workspaceId, reservationId, parsed.data, { userId, role });
  } catch (error) {
    await logActionError("updateReservation", error);
    const message =
      error instanceof Error ? error.message : "Could not update the reservation.";
    return { status: "error", message };
  }

  revalidateReservationPaths();
  return { status: "success", message: "Reservation updated." };
}

export async function updateReservationStatusAction(
  reservationId: string,
  nextStatus: string,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const parsed = reservationStatusInputSchema.safeParse({ status: nextStatus });
  if (!parsed.success) {
    return {
      status: "error",
      message: `Status must be one of: ${RESERVATION_STATUSES.join(", ")}.`,
    };
  }

  try {
    await updateReservationStatus(workspaceId, reservationId, parsed.data.status, {
      userId,
      role,
    });
  } catch (error) {
    await logActionError("updateReservationStatus", error);
    const message =
      error instanceof Error ? error.message : "Could not update the reservation status.";
    return { status: "error", message };
  }

  revalidateReservationPaths();
  return { status: "success", message: "Reservation status updated." };
}

export async function deleteReservationAction(
  reservationId: string,
): Promise<FormActionResult> {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  try {
    await softDeleteReservation(workspaceId, reservationId, { userId, role });
  } catch (error) {
    await logActionError("deleteReservation", error);
    const message =
      error instanceof Error ? error.message : "Could not delete the reservation.";
    return { status: "error", message };
  }

  revalidateReservationPaths();
  return { status: "success", message: "Reservation deleted." };
}
