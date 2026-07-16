"use client";

import { FieldInput } from "../business-profile/field-input";
import { FieldTextarea } from "../business-profile/field-textarea";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { PropertyListItem } from "../../../src/server/validators/property";

interface PropertyFormFieldsProps {
  property: PropertyListItem | null;
  fieldErrors: FieldErrors;
}

/* Shared field markup for both create and edit — so the two never duplicate
   field JSX (mirrors reservation-form-fields.tsx's pattern). */
export function PropertyFormFields({ property, fieldErrors }: PropertyFormFieldsProps) {
  return (
    <div className="flex flex-col gap-5">
      <FieldInput
        label="Name"
        name="name"
        required
        defaultValue={property?.name ?? ""}
        error={fieldErrors.name?.[0]}
      />
      <FieldInput
        label="Address line 1"
        name="addressLine1"
        defaultValue={property?.addressLine1 ?? ""}
        error={fieldErrors.addressLine1?.[0]}
      />
      <FieldInput
        label="Address line 2"
        name="addressLine2"
        defaultValue={property?.addressLine2 ?? ""}
        error={fieldErrors.addressLine2?.[0]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldInput label="City" name="city" defaultValue={property?.city ?? ""} error={fieldErrors.city?.[0]} />
        <FieldInput label="State" name="state" defaultValue={property?.state ?? ""} error={fieldErrors.state?.[0]} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldInput
          label="Postal code"
          name="postalCode"
          defaultValue={property?.postalCode ?? ""}
          error={fieldErrors.postalCode?.[0]}
        />
        <FieldInput label="Country" name="country" defaultValue={property?.country ?? ""} error={fieldErrors.country?.[0]} />
      </div>
      <FieldTextarea label="Description" name="description" rows={3} defaultValue={property?.description ?? ""} />
    </div>
  );
}
