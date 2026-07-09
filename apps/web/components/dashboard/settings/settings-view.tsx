import { Reveal, RevealItem } from "../../landing/reveal";
import { AppearanceSettings } from "./appearance-settings";
import { BackupSettings } from "./backup-settings";
import { DangerZone } from "./danger-zone";
import { GeneralSettings } from "./general-settings";
import { IntegrationsSettings } from "./integrations-settings";
import { NotificationSettings } from "./notification-settings";
import { SecuritySettings } from "./security-settings";
import { SettingsHeader } from "./settings-header";

export function SettingsView() {
  return (
    <Reveal as="div" className="flex flex-col gap-10">
      <RevealItem>
        <SettingsHeader />
      </RevealItem>
      <GeneralSettings />
      <NotificationSettings />
      <SecuritySettings />
      <AppearanceSettings />
      <IntegrationsSettings />
      <BackupSettings />
      <DangerZone />
    </Reveal>
  );
}
