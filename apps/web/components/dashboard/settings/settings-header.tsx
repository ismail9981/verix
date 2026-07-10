"use client";

import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PageHeader } from "../ui/page-header";

interface SettingsHeaderProps {
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

export function SettingsHeader({ onSave, saving, dirty }: SettingsHeaderProps) {
  return (
    <PageHeader
      title="Settings"
      subtitle="Manage your workspace, appearance, notifications, and preferences."
      actions={
        <Button
          type="button"
          className={CTA_PRIMARY}
          loading={saving}
          disabled={!dirty && !saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      }
    />
  );
}
