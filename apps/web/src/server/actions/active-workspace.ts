"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db/db";
import { logger } from "../observability/logger";
import { safeRedirectPath } from "../../lib/safe-redirect";
import { requireUser } from "../auth/session";
import { resolveActiveWorkspaceInTransaction } from "../auth/active-workspace";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  activeWorkspaceCookieOptions,
  signActiveWorkspaceCookie,
} from "../auth/active-workspace-cookie";

export async function switchActiveWorkspaceAction(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const destination = safeRedirectPath(
    typeof formData.get("redirectTo") === "string"
      ? String(formData.get("redirectTo"))
      : null,
  );
  const user = await requireUser();
  const metadata = user.user_metadata as { full_name?: string } | undefined;
  const result = await db.transaction((tx) =>
    resolveActiveWorkspaceInTransaction(
      tx,
      {
        id: user.id,
        email: user.email ?? null,
        name: metadata?.full_name ?? null,
        emailVerified: Boolean(user.email_confirmed_at),
      },
      workspaceId,
    ),
  );

  if (result.state !== "SELECTED" && result.state !== "AUTO_SELECTED") {
    logger.warn("workspace.selection_refused", {
      authUserRef: user.id.slice(0, 8),
      reason: result.state,
    });
    redirect(`/workspace-selection?state=${result.state.toLowerCase()}`);
  }
  if (result.context.workspaceId !== workspaceId) {
    logger.warn("workspace.selection_refused", {
      authUserRef: user.id.slice(0, 8),
      reason: "CANDIDATE_MISMATCH",
    });
    redirect("/workspace-selection?state=invalid_selection");
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ACTIVE_WORKSPACE_COOKIE_NAME,
    signActiveWorkspaceCookie(
      workspaceId,
      process.env.ACTIVE_WORKSPACE_COOKIE_SECRET,
    ),
    activeWorkspaceCookieOptions,
  );
  logger.info("workspace.selected", {
    authUserRef: user.id.slice(0, 8),
    workspaceRef: workspaceId.slice(0, 8),
  });
  redirect(destination);
}

