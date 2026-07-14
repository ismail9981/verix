"use server";

import { revalidatePath } from "next/cache";
import {
  DUPLICATE_DOMAIN_ERROR,
  createDomain,
  deleteDomain,
  setPrimaryDomain,
  updateDomain,
} from "../services/domain.service";
import { createDomainSchema, updateDomainSchema } from "../validators/domain";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for domains. The workspace is derived from the session; site
 * and domain ownership are verified in the service. Independent of publishing.
 */

const DUPLICATE_MESSAGE = "That hostname is already taken.";

function isDuplicate(error: unknown): boolean {
  if (error instanceof Error && error.message === DUPLICATE_DOMAIN_ERROR) {
    return true;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function createDomainAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = createDomainSchema.safeParse({
    siteId: formData.get("siteId"),
    type: formData.get("type"),
    value: formData.get("value"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    await createDomain(workspaceId, parsed.data);
  } catch (error) {
    if (isDuplicate(error)) {
      return {
        status: "error",
        message: DUPLICATE_MESSAGE,
        fieldErrors: { value: [DUPLICATE_MESSAGE] },
      };
    }
    await logActionError("createDomain", error);
    return { status: "error", message: "Could not add the domain." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Domain added." };
}

export async function updateDomainAction(
  domainId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  const parsed = updateDomainSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    await updateDomain(workspaceId, domainId, parsed.data);
  } catch (error) {
    await logActionError("updateDomain", error);
    return { status: "error", message: "Could not update the domain." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Domain updated." };
}

export async function deleteDomainAction(
  domainId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    await deleteDomain(workspaceId, domainId);
  } catch (error) {
    await logActionError("deleteDomain", error);
    return { status: "error", message: "Could not remove the domain." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Domain removed." };
}

export async function setPrimaryDomainAction(
  siteId: string,
  domainId: string,
): Promise<FormActionResult> {
  const { workspaceId } = await getAuthorizedWorkspace();
  try {
    await setPrimaryDomain(workspaceId, siteId, domainId);
  } catch (error) {
    await logActionError("setPrimaryDomain", error);
    return { status: "error", message: "Could not set the primary domain." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Primary domain updated." };
}
