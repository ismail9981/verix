"use client";

import { FieldSelect } from "../business-profile/field-select";
import {
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
  WEEK_START_OPTIONS,
} from "../../../src/server/validators/settings";
import { SettingsSection } from "./settings-section";
import type { SectionProps } from "./types";

export function LocalizationSettings({ values, set, onReset }: SectionProps) {
  return (
    <SettingsSection
      id="localization"
      title="Localization"
      description="How dates and times are displayed."
      onReset={onReset}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <FieldSelect
          label="Date format"
          name="dateFormat"
          options={DATE_FORMAT_OPTIONS}
          value={values.dateFormat}
          onChange={(e) =>
            set("dateFormat", e.target.value as typeof values.dateFormat)
          }
        />
        <FieldSelect
          label="Time format"
          name="timeFormat"
          options={TIME_FORMAT_OPTIONS}
          value={values.timeFormat}
          onChange={(e) =>
            set("timeFormat", e.target.value as typeof values.timeFormat)
          }
        />
        <FieldSelect
          label="Week starts on"
          name="weekStartsOn"
          options={WEEK_START_OPTIONS}
          value={values.weekStartsOn}
          onChange={(e) =>
            set("weekStartsOn", e.target.value as typeof values.weekStartsOn)
          }
        />
      </div>
    </SettingsSection>
  );
}
