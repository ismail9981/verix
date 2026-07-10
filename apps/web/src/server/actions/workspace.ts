"use server";

import { revalidatePath } from "next/cache";
import { updateWorkspaceProfile } from "../services/workspace.service";
import { updateWorkspaceProfileSchema } from "../validators/workspace";

/*
 * Server Actions for the Business Profile feature — the boundary between the
 * client form and the service layer. Responsibilities: parse/validate the
 * FormData, translate service/database errors into a typed result the UI can
 * render, and revalidate the page cache. All DB logic lives in the service.
 */

export type ProfileFieldErrors = Partial<Record<string, string[]>>;

export interface ProfileActionResult {
  status: "success" | "error";
  message: string;
  fieldErrors?: ProfileFieldErrors;
}

export async function updateBusinessProfileAction(
  workspaceId: string,
  formData: FormData,
): Promise<ProfileActionResult> {
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
    const fieldErrors: ProfileFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
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
