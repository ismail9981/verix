"use client";

import { useState } from "react";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { FieldTextarea } from "../business-profile/field-textarea";
import { UNIT_CONDITION_OVERRIDES, UNIT_TYPES } from "../../../src/server/validators/rental-unit";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { RentalUnitListItem } from "../../../src/server/validators/rental-unit";

const UNIT_TYPE_OPTIONS = UNIT_TYPES.map((t) => ({
  value: t,
  label: t.charAt(0).toUpperCase() + t.slice(1),
}));

const STATUS_OVERRIDE_LABELS: Record<(typeof UNIT_CONDITION_OVERRIDES)[number], string> = {
  cleaning: "Cleaning",
  maintenance: "Maintenance",
  out_of_service: "Out of service",
};

const STATUS_OVERRIDE_OPTIONS = [
  { value: "", label: "None — derive from reservations" },
  ...UNIT_CONDITION_OVERRIDES.map((s) => ({ value: s, label: STATUS_OVERRIDE_LABELS[s] })),
];

interface UnitFormFieldsProps {
  unit: RentalUnitListItem | null;
  defaultCurrency: string;
  fieldErrors: FieldErrors;
}

/* Shared field markup for both create and edit — placement (property/building)
   is fixed by the page this form is rendered from and never shown here (see
   rental-unit.service.ts's module doc comment). */
export function UnitFormFields({ unit, defaultCurrency, fieldErrors }: UnitFormFieldsProps) {
  const [amenities, setAmenities] = useState(unit?.amenities.join(", ") ?? "");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldInput label="Name" name="name" required defaultValue={unit?.name ?? ""} error={fieldErrors.name?.[0]} />
        <FieldInput
          label="Unit number"
          name="unitNumber"
          defaultValue={unit?.unitNumber ?? ""}
          error={fieldErrors.unitNumber?.[0]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldSelect label="Type" name="unitType" options={UNIT_TYPE_OPTIONS} defaultValue={unit?.unitType ?? "room"} />
        <FieldInput label="Floor" name="floor" type="number" defaultValue={unit?.floor != null ? String(unit.floor) : ""} error={fieldErrors.floor?.[0]} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldInput
          label="Capacity"
          name="capacity"
          type="number"
          min={1}
          required
          defaultValue={unit ? String(unit.capacity) : "1"}
          error={fieldErrors.capacity?.[0]}
        />
        <FieldInput
          label="Bedrooms"
          name="bedrooms"
          type="number"
          min={0}
          defaultValue={unit ? String(unit.bedrooms) : "0"}
          error={fieldErrors.bedrooms?.[0]}
        />
        <FieldInput
          label="Bathrooms"
          name="bathrooms"
          type="number"
          min={0}
          defaultValue={unit ? String(unit.bathrooms) : "0"}
          error={fieldErrors.bathrooms?.[0]}
        />
      </div>

      <FieldInput
        label="Size (sq ft)"
        name="sizeSqFt"
        type="number"
        min={0}
        defaultValue={unit?.sizeSqFt != null ? String(unit.sizeSqFt) : ""}
        error={fieldErrors.sizeSqFt?.[0]}
      />

      <FieldInput
        label={`Default rate (${(unit?.currency ?? defaultCurrency).toUpperCase()})`}
        name="amount"
        type="number"
        min={0}
        step="0.01"
        required
        defaultValue={unit ? String(unit.priceCents / 100) : ""}
        error={fieldErrors.amount?.[0]}
        helperText="Priced in the workspace's currency, set in Settings."
      />

      <FieldInput
        label="Amenities"
        name="amenities"
        placeholder="Wifi, Parking, Pool"
        value={amenities}
        onChange={(event) => setAmenities(event.target.value)}
        helperText="Comma-separated list."
      />

      <FieldSelect
        label="Condition override"
        name="statusOverride"
        options={STATUS_OVERRIDE_OPTIONS}
        defaultValue={unit?.statusOverride ?? ""}
      />

      <FieldTextarea label="Description" name="description" rows={2} defaultValue={unit?.description ?? ""} />
      <FieldTextarea label="Notes" name="notes" rows={2} defaultValue={unit?.notes ?? ""} />
    </div>
  );
}
