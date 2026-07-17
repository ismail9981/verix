"use client";

import { FieldInput } from "../business-profile/field-input";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { BuildingListItem } from "../../../src/server/validators/building";

interface BuildingFormFieldsProps {
  building: BuildingListItem | null;
  fieldErrors: FieldErrors;
}

export function BuildingFormFields({ building, fieldErrors }: BuildingFormFieldsProps) {
  return (
    <FieldInput
      label="Name"
      name="name"
      required
      defaultValue={building?.name ?? ""}
      error={fieldErrors.name?.[0]}
    />
  );
}
