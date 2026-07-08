"use client";

import { useState } from "react";
import { FieldInput } from "./field-input";
import { TAX } from "./mock-data";
import { ProfileSection } from "./profile-section";
import { Toggle } from "./toggle";

export function TaxSettings() {
  const [enabled, setEnabled] = useState(TAX.enabled);

  return (
    <ProfileSection
      id="tax"
      title="Tax settings"
      description="Apply tax to invoices and checkout. Configure the rate charged to customers."
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Enable tax</p>
            <p className="mt-0.5 text-sm text-muted">
              Add tax to all invoices and bookings.
            </p>
          </div>
          <Toggle
            checked={enabled}
            onChange={setEnabled}
            label="Enable tax"
          />
        </div>

        <div className="max-w-xs">
          <FieldInput
            label="Tax percentage"
            name="taxPercentage"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.1}
            defaultValue={TAX.percentage}
            disabled={!enabled}
            rightIcon={<span className="text-sm text-muted">%</span>}
          />
        </div>
      </div>
    </ProfileSection>
  );
}
