"use server";

import { revalidatePath } from "next/cache";
import { updateWorkspaceProfile } from "../services/workspace.service";
import { updateWorkspaceProfileSchema } from "../validators/workspace";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for the Business Profile feature — the boundary between the
 * client form and the service layer. Responsibilities: parse/validate the
 * FormData, translate service/database errors into a typed result the UI can
 * render, and revalidate the page cache. All DB logic lives in the service.
 */

// Kept as a named alias so the existing client import stays stable.
export type ProfileActionResult = FormActionResult;

export async function updateBusinessProfileAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = updateWorkspaceProfileSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    website: formData.get("website"),
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
    language: formData.get("language"),
    logoUrl: formData.get("logoUrl"),
    coverImageUrl: formData.get("coverImageUrl"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateWorkspaceProfile(workspaceId, parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: "That URL slug is already taken.",
        fieldErrors: { slug: ["This slug is already in use."] },
      };
    }
    await logActionError("updateBusinessProfile", error);
    return {
      status: "error",
      message: "Could not save changes. Please try again.",
    };
  }

  revalidatePath("/business-profile");
  return { status: "success", message: "Business profile saved." };
}

/** Postgres unique-violation error code. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
