"use server";

import { revalidatePath } from "next/cache";
import {
  createBooking,
  softDeleteBooking,
  updateBooking,
} from "../services/booking.service";
import { bookingInputSchema } from "../validators/booking";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for the Bookings feature — validate form data, delegate to the
 * service layer, map errors to a typed result, and revalidate the Bookings page.
 */

function parseInput(formData: FormData) {
  return bookingInputSchema.safeParse({
    customerId: formData.get("customerId"),
    serviceId: formData.get("serviceId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
}

export async function createBookingAction(
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
    await createBooking(workspaceId, parsed.data);
  } catch (error) {
    await logActionError("createBooking", error);
    return { status: "error", message: "Could not create the booking." };
  }

  revalidatePath("/bookings");
  return { status: "success", message: "Booking created." };
}

export async function updateBookingAction(
  bookingId: string,
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
    await updateBooking(workspaceId, bookingId, parsed.data);
  } catch (error) {
    await logActionError("updateBooking", error);
    return { status: "error", message: "Could not update the booking." };
  }

  revalidatePath("/bookings");
  return { status: "success", message: "Booking updated." };
}

export async function deleteBookingAction(
  bookingId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    await softDeleteBooking(workspaceId, bookingId);
  } catch (error) {
    await logActionError("deleteBooking", error);
    return { status: "error", message: "Could not delete the booking." };
  }

  revalidatePath("/bookings");
  return { status: "success", message: "Booking deleted." };
}
