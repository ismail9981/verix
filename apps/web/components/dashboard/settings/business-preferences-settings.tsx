"use client";

import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import {
  BOOKING_DURATION_OPTIONS,
  BOOKING_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from "../../../src/server/validators/settings";
import { SettingsSection } from "./settings-section";
import { ToggleRow } from "./toggle-row";
import type { SectionProps } from "./types";

export function BusinessPreferencesSettings({
  values,
  set,
  onReset,
}: SectionProps) {
  return (
    <SettingsSection
      id="business"
      title="Business preferences"
      description="Defaults applied to new bookings and payments."
      onReset={onReset}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FieldSelect
            label="Default booking duration"
            name="defaultBookingDurationMinutes"
            options={BOOKING_DURATION_OPTIONS}
            value={String(values.defaultBookingDurationMinutes)}
            onChange={(e) =>
              set("defaultBookingDurationMinutes", Number(e.target.value))
            }
          />
          <FieldSelect
            label="Default booking status"
            name="defaultBookingStatus"
            options={BOOKING_STATUS_OPTIONS}
            value={values.defaultBookingStatus}
            onChange={(e) =>
              set(
                "defaultBookingStatus",
                e.target.value as typeof values.defaultBookingStatus,
              )
            }
          />
          <FieldSelect
            label="Default payment method"
            name="defaultPaymentMethod"
            options={PAYMENT_METHOD_OPTIONS}
            value={values.defaultPaymentMethod}
            onChange={(e) =>
              set(
                "defaultPaymentMethod",
                e.target.value as typeof values.defaultPaymentMethod,
              )
            }
          />
          <FieldInput
            label="Tax percentage (%)"
            name="taxPercent"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={String(values.taxPercent)}
            onChange={(e) => set("taxPercent", Number(e.target.value))}
          />
        </div>
        <div className="border-t border-hairline pt-1">
          <ToggleRow
            label="Enable tax"
            description="Apply tax to invoices and payments."
            checked={values.taxEnabled}
            onChange={(v) => set("taxEnabled", v)}
          />
        </div>
      </div>
    </SettingsSection>
  );
}
