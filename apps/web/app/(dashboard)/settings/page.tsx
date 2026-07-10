import type { Metadata } from "next";
import { getAuthorizedWorkspace } from "../../../src/server/auth/workspace";
import { getSettings } from "../../../src/server/services/settings.service";
import { SettingsManager } from "../../../components/dashboard/settings/settings-manager";

export const metadata: Metadata = {
  title: "Settings",
};

// Reads live settings on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { workspaceId } = await getAuthorizedWorkspace();
  const settings = await getSettings(workspaceId);

  return <SettingsManager initial={settings} />;
}
