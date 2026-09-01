"use server";

import { z } from "zod";
import { requirePlatformCapability } from "../auth/platform-authorize";
import { PlatformAuthorizationError } from "../auth/platform-authorize";
import { logActionError } from "../observability/request-context";
import { PlatformServiceError } from "../services/platform-errors";
import {
  readPlatformWorkspaceSummaries,
  type PlatformWorkspaceSummary,
} from "../services/platform-workspace.service";
import type { PlatformActionResult } from "./platform-action-result";

const readProofInputSchema = z.object({}).strict();

function authorizationFailure(
  error: PlatformAuthorizationError,
): PlatformActionResult<never> {
  return error.code === "UNAUTHENTICATED"
    ? {
        status: "error",
        code: "UNAUTHENTICATED",
        message: "Authentication is required.",
      }
    : {
        status: "error",
        code: "UNAUTHORIZED",
        message: "You are not authorized to perform this operation.",
      };
}

function serviceFailure(
  error: PlatformServiceError,
): PlatformActionResult<never> {
  const messages = {
    INVALID_INPUT: "The submitted input is invalid.",
    NOT_FOUND: "The requested resource was not found.",
    CONFLICT: "The operation conflicts with the current state.",
    INTERNAL: "The operation could not be completed.",
  } as const;
  return { status: "error", code: error.code, message: messages[error.code] };
}

/**
 * C3 direct-invocation proof. Authorization deliberately occurs before strict
 * validation, so forged actor/role/capability fields never influence trust.
 */
export async function readPlatformWorkspacesAction(
  input: unknown = {},
): Promise<PlatformActionResult<readonly PlatformWorkspaceSummary[]>> {
  let context;
  try {
    context = await requirePlatformCapability("platform.workspaces.read");
  } catch (error) {
    if (error instanceof PlatformAuthorizationError) {
      return authorizationFailure(error);
    }
    await logActionError("readPlatformWorkspaces.authorization", error);
    return {
      status: "error",
      code: "INTERNAL",
      message: "The operation could not be completed.",
    };
  }

  const parsed = readProofInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      code: "INVALID_INPUT",
      message: "The submitted input is invalid.",
    };
  }

  try {
    return {
      status: "success",
      data: await readPlatformWorkspaceSummaries(context),
    };
  } catch (error) {
    if (error instanceof PlatformServiceError) return serviceFailure(error);
    await logActionError("readPlatformWorkspaces", error);
    return {
      status: "error",
      code: "INTERNAL",
      message: "The operation could not be completed.",
    };
  }
}
