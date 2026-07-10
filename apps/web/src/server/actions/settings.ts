"use server";

import { revalidatePath } from "next/cache";
import { resetSection, saveSettings } from "../services/settings.service";
import {
  SETTINGS_SECTIONS,
  settingsInputSchema,
  type SettingsSection,
  type SettingsValues,
} from "../validators/settings";
import { getAuthorizedWorkspace } from "../auth/workspace";
import { logActionError } from "../observability/request-context";
import { zodFieldErrors, type FormActionResult } from "./action-result";

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
  const { workspaceId } = await getAuthorizedWorkspace();
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
  const { workspaceId } = await getAuthorizedWorkspace();

  try {
    const values = await resetSection(workspaceId, section);
    revalidatePath("/settings");
    return { status: "success", message: "Section reset to defaults.", values };
  } catch (error) {
    await logActionError("resetSection", error);
    return { status: "error", message: "Could not reset the section." };
  }
}
