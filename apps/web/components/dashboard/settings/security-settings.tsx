"use client";

import { FieldSelect } from "../business-profile/field-select";
import { SESSION_TIMEOUT_OPTIONS } from "../../../src/server/validators/settings";
import { SettingsSection } from "./settings-section";
import { ToggleRow } from "./toggle-row";
import type { SectionProps } from "./types";

export function SecuritySettings({ values, set, onReset }: SectionProps) {
  return (
    <SettingsSection
      id="security"
      title="Security"
      description="Protect your workspace and account access."
      onReset={onReset}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col divide-y divide-hairline">
          <ToggleRow
            label="Two-factor authentication"
            description="Require a second step when signing in."
            checked={values.twoFactorEnabled}
            onChange={(v) => set("twoFactorEnabled", v)}
          />
          <ToggleRow
            label="Login alerts"
            description="Email me when a new device signs in."
            checked={values.loginAlerts}
            onChange={(v) => set("loginAlerts", v)}
          />
        </div>
        <div className="border-t border-hairline pt-5 sm:max-w-xs">
          <FieldSelect
            label="Session timeout"
            name="sessionTimeoutMinutes"
            options={SESSION_TIMEOUT_OPTIONS}
            value={String(values.sessionTimeoutMinutes)}
            onChange={(e) =>
              set("sessionTimeoutMinutes", Number(e.target.value))
            }
          />
        </div>
      </div>
    </SettingsSection>
  );
}
