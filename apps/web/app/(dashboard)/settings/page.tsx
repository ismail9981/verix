import type { Metadata } from "next";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";
import { getSettings } from "../../../src/server/services/settings.service";
import { SettingsManager } from "../../../components/dashboard/settings/settings-manager";
import { hasCapability } from "../../../src/server/auth/capabilities";

export const metadata: Metadata = {
  title: "Settings",
};

// Reads live settings on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspace = await requirePageCapability("workspace.settings.read");
  const { workspaceId } = workspace;
  const settings = await getSettings(workspaceId);

  return (
    <SettingsManager
      initial={settings}
      canUpdate={hasCapability(workspace, "workspace.settings.update")}
    />
  );
}
