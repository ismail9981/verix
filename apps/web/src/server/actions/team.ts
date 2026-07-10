"use server";

import { revalidatePath } from "next/cache";
import {
  inviteMember,
  removeMember,
  updateMember,
} from "../services/team.service";
import {
  DUPLICATE_MEMBERSHIP_ERROR,
  inviteMemberSchema,
  updateMemberSchema,
} from "../validators/team";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for the Team feature — derive the workspace from the session
 * (never the client), validate, delegate to the service, and revalidate /team.
 */

const DUPLICATE_MESSAGE =
  "That person is already a member of this workspace.";

function isDuplicate(error: unknown): boolean {
  if (error instanceof Error && error.message === DUPLICATE_MEMBERSHIP_ERROR) {
    return true;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function inviteMemberAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = inviteMemberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await inviteMember(workspaceId, parsed.data);
  } catch (error) {
    if (isDuplicate(error)) {
      return {
        status: "error",
        message: DUPLICATE_MESSAGE,
        fieldErrors: { email: [DUPLICATE_MESSAGE] },
      };
    }
    await logActionError("inviteMember", error);
    return { status: "error", message: "Could not invite the member." };
  }

  revalidatePath("/team");
  return { status: "success", message: "Member invited." };
}

export async function updateMemberAction(
  memberId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = updateMemberSchema.safeParse({
    role: formData.get("role"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await updateMember(workspaceId, memberId, parsed.data);
  } catch (error) {
    await logActionError("updateMember", error);
    return { status: "error", message: "Could not update the member." };
  }

  revalidatePath("/team");
  return { status: "success", message: "Member updated." };
}

export async function removeMemberAction(
  memberId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();

  try {
    await removeMember(workspaceId, memberId);
  } catch (error) {
    await logActionError("removeMember", error);
    return { status: "error", message: "Could not remove the member." };
  }

  revalidatePath("/team");
  return { status: "success", message: "Member removed." };
}
