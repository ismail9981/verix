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
import { requireActiveWorkspaceCapability } from "../auth/authorize";
import { AuthorizationError } from "../auth/rbac";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for the Team feature — derive the workspace from the session
 * (never the client), validate, delegate to the service, and revalidate /team.
 */

const DUPLICATE_MESSAGE = "That person is already a member of this workspace.";

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

/*
 * Turn an authorization failure into a typed error result, surfacing its
 * (safe, human) message. Anything else — including Next's redirect signal from
 * an unauthenticated session — is rethrown so it propagates unchanged.
 */
function authorizationResult(error: unknown): FormActionResult {
  if (error instanceof AuthorizationError) {
    return { status: "error", message: error.message };
  }
  throw error;
}

export async function inviteMemberAction(
  formData: FormData,
): Promise<FormActionResult> {
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireActiveWorkspaceCapability(
      "workspace.members.invite",
    ));
  } catch (error) {
    return authorizationResult(error);
  }
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
  let workspaceId: string;
  let userId: string;
  try {
    ({ workspaceId, userId } = await requireActiveWorkspaceCapability(
      "workspace.members.update",
    ));
  } catch (error) {
    return authorizationResult(error);
  }
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
    await updateMember(workspaceId, memberId, parsed.data, { userId });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: "error", message: error.message };
    }
    await logActionError("updateMember", error);
    return { status: "error", message: "Could not update the member." };
  }

  revalidatePath("/team");
  return { status: "success", message: "Member updated." };
}

export async function removeMemberAction(
  memberId: string,
): Promise<FormActionResult> {
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireActiveWorkspaceCapability(
      "workspace.members.remove",
    ));
  } catch (error) {
    return authorizationResult(error);
  }

  try {
    await removeMember(workspaceId, memberId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: "error", message: error.message };
    }
    await logActionError("removeMember", error);
    return { status: "error", message: "Could not remove the member." };
  }

  revalidatePath("/team");
  return { status: "success", message: "Member removed." };
}
