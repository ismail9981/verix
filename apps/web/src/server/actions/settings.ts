"use server";

import { revalidatePath } from "next/cache";
import { resetSection, saveSettings } from "../services/settings.service";
import {
  SETTINGS_SECTIONS,
  settingsInputSchema,
  type SettingsSection,
  type SettingsValues,
} from "../validators/settings";
import { requireOwner } from "../auth/authorize";
import { AuthorizationError } from "../auth/rbac";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/** Owner-only gate for administrative settings; rethrows non-auth signals. */
async function requireOwnerWorkspace(): Promise<
  { workspaceId: string } | SettingsActionResult
> {
  try {
    const { workspaceId } = await requireOwner();
    return { workspaceId };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

/*
 * Server Actions for the Settings module. The workspace is always derived from
 * the session (never the client). Save validates + persists only changed
 * fields; reset restores one section to defaults.
 */

export interface SettingsActionResult extends FormActionResult {
  values?: SettingsValues;
}

export async function saveSettingsAction(
  input: unknown,
): Promise<SettingsActionResult> {
  const auth = await requireOwnerWorkspace();
  if ("status" in auth) return auth;
  const { workspaceId } = auth;
  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    const values = await saveSettings(workspaceId, parsed.data);
    revalidatePath("/settings");
    return { status: "success", message: "Settings saved.", values };
  } catch (error) {
    await logActionError("saveSettings", error);
    return { status: "error", message: "Could not save settings." };
  }
}

export async function resetSectionAction(
  section: SettingsSection,
): Promise<SettingsActionResult> {
  if (!SETTINGS_SECTIONS.includes(section)) {
    return { status: "error", message: "Unknown section." };
  }
  const auth = await requireOwnerWorkspace();
  if ("status" in auth) return auth;
  const { workspaceId } = auth;

  try {
    const values = await resetSection(workspaceId, section);
    revalidatePath("/settings");
    return { status: "success", message: "Section reset to defaults.", values };
  } catch (error) {
    await logActionError("resetSection", error);
    return { status: "error", message: "Could not reset the section." };
  }
}
