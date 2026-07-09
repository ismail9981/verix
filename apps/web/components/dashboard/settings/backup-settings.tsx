import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { DownloadIcon } from "../analytics/icons";
import { UploadIcon } from "../business-profile/icons";
import { ProfileSection } from "../business-profile/profile-section";
import type { IconComponent } from "../types";
import { DatabaseIcon } from "./icons";

const ROWS: {
  id: string;
  label: string;
  description: string;
  action: string;
  icon: IconComponent;
}[] = [
  { id: "export", label: "Export data", description: "Download all your workspace data as CSV.", action: "Export", icon: DownloadIcon },
  { id: "backup", label: "Backup", description: "Last backup: Jul 8, 2026 · 3:00 AM.", action: "Back up now", icon: DatabaseIcon },
  { id: "restore", label: "Restore", description: "Restore your workspace from a previous backup.", action: "Restore", icon: UploadIcon },
];

export function BackupSettings() {
  return (
    <ProfileSection
      id="backup"
      title="Backup & export"
      description="Keep a copy of your data and restore it when needed."
    >
      <div className="flex flex-col divide-y divide-hairline">
        {ROWS.map(({ id, label, description, action, icon: Icon }) => (
          <div key={id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="truncate text-xs text-muted">{description}</p>
            </div>
            <Button type="button" size="sm" className={CTA_SECONDARY}>
              {action}
            </Button>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}
