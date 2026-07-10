"use client";

import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import {
  CURRENCIES,
  LANGUAGES,
  TIMEZONES,
} from "../business-profile/mock-data";
import { SettingsSection } from "./settings-section";
import type { SectionProps } from "./types";

export function GeneralSettings({ values, set, onReset }: SectionProps) {
  return (
    <SettingsSection
      id="general"
      title="General"
      description="Basic workspace details and regional preferences."
      onReset={onReset}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldInput
            label="Business name"
            name="businessName"
            value={values.businessName}
            onChange={(e) => set("businessName", e.target.value)}
          />
        </div>
        <FieldSelect
          label="Default language"
          name="language"
          options={LANGUAGES}
          value={values.language}
          onChange={(e) => set("language", e.target.value)}
        />
        <FieldSelect
          label="Timezone"
          name="timezone"
          options={TIMEZONES}
          value={values.timezone}
          onChange={(e) => set("timezone", e.target.value)}
        />
        <FieldSelect
          label="Currency"
          name="currency"
          options={CURRENCIES}
          value={values.currency}
          onChange={(e) => set("currency", e.target.value)}
        />
      </div>
    </SettingsSection>
  );
}
