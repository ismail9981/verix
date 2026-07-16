"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { UnitFormFields } from "./unit-form-fields";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { RentalUnitListItem } from "../../../src/server/validators/rental-unit";

interface UnitFormDrawerProps {
  open: boolean;
  unit: RentalUnitListItem | null;
  defaultCurrency: string;
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

export function UnitFormDrawer({
  open,
  unit,
  defaultCurrency,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: UnitFormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={unit ? "Edit unit" : "New unit"}
      ariaLabel={unit ? "Edit unit" : "New unit"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <UnitFormFields unit={unit} defaultCurrency={defaultCurrency} fieldErrors={fieldErrors} />

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {unit ? "Save changes" : "Create unit"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
