"use server";

import { revalidatePath } from "next/cache";
import {
  DUPLICATE_DOMAIN_ERROR,
  createDomain,
  deleteDomain,
  setPrimaryDomain,
} from "../services/domain.service";
import {
  DomainVerificationError,
  regenerateVerificationToken,
  verifyDomain,
} from "../services/domain-verification.service";
import { createDomainSchema, domainIdSchema } from "../validators/domain";
import { requireActiveWorkspaceCapability } from "../auth/authorize";
import { AuthorizationError } from "../auth/rbac";
import { getRequestId, logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Server Actions for domains. The workspace is derived from the session; site
 * and domain ownership are verified in the service. Independent of publishing.
 * Verify/regenerate-token/delete are owner-only (RBAC per Sprint 7.2).
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

export async function createDomainAction(
  formData: FormData,
): Promise<FormActionResult> {
  const { workspaceId } = await requireActiveWorkspaceCapability(
    "website.domain.manage",
  );
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

export async function deleteDomainAction(
  domainId: string,
): Promise<FormActionResult> {
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireActiveWorkspaceCapability(
      "website.domain.manage",
    ));
  } catch (error) {
    return authorizationResult(error);
  }
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
  const { workspaceId } = await requireActiveWorkspaceCapability(
    "website.domain.manage",
  );
  try {
    await setPrimaryDomain(workspaceId, siteId, domainId);
  } catch (error) {
    await logActionError("setPrimaryDomain", error);
    return { status: "error", message: "Could not set the primary domain." };
  }
  revalidatePath("/website-builder");
  return { status: "success", message: "Primary domain updated." };
}

export async function verifyDomainAction(
  siteId: string,
  domainId: string,
): Promise<FormActionResult> {
  let workspaceId: string;
  let userId: string;
  try {
    ({ workspaceId, userId } = await requireActiveWorkspaceCapability(
      "website.domain.manage",
    ));
  } catch (error) {
    return authorizationResult(error);
  }
  const parsed = domainIdSchema.safeParse({ domainId });
  if (!parsed.success) {
    return { status: "error", message: "Invalid domain." };
  }
  try {
    const domain = await verifyDomain({
      workspaceId,
      siteId,
      userId,
      domainId: parsed.data.domainId,
      requestId: await getRequestId(),
    });
    revalidatePath("/website-builder");
    return domain.status === "verified"
      ? { status: "success", message: "Domain verified." }
      : {
          status: "error",
          message: domain.verificationError ?? "Verification failed.",
        };
  } catch (error) {
    if (error instanceof DomainVerificationError) {
      return { status: "error", message: error.message };
    }
    await logActionError("verifyDomain", error);
    return { status: "error", message: "Could not verify the domain." };
  }
}

export async function regenerateDomainVerificationTokenAction(
  siteId: string,
  domainId: string,
): Promise<FormActionResult> {
  let workspaceId: string;
  let userId: string;
  try {
    ({ workspaceId, userId } = await requireActiveWorkspaceCapability(
      "website.domain.manage",
    ));
  } catch (error) {
    return authorizationResult(error);
  }
  const parsed = domainIdSchema.safeParse({ domainId });
  if (!parsed.success) {
    return { status: "error", message: "Invalid domain." };
  }
  try {
    await regenerateVerificationToken({
      workspaceId,
      siteId,
      userId,
      domainId: parsed.data.domainId,
      requestId: await getRequestId(),
    });
  } catch (error) {
    if (error instanceof DomainVerificationError) {
      return { status: "error", message: error.message };
    }
    await logActionError("regenerateDomainVerificationToken", error);
    return { status: "error", message: "Could not regenerate the token." };
  }
  revalidatePath("/website-builder");
  return {
    status: "success",
    message: "New verification token generated. Update your DNS record.",
  };
}
