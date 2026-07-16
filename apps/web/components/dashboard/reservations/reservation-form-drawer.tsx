"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { ReservationFormFields } from "./reservation-form-fields";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  ReservationListItem,
  ReservationPersonOption,
} from "../../../src/server/validators/reservation";
import type { RentalUnitOption } from "../../../src/server/validators/rental-unit";

interface ReservationFormDrawerProps {
  open: boolean;
  reservation: ReservationListItem | null;
  unitOptions: RentalUnitOption[];
  customerOptions: ReservationPersonOption[];
  staffOptions: ReservationPersonOption[];
  defaultCurrency: string;
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

/* Edit-only — creation happens on its own page (/reservations/new). Reuses
   ReservationFormFields for the field markup so create/edit never duplicate
   it. Uncontrolled (defaultValue), read via FormData; the parent remounts it
   with a `key` to reset between reservations. */
export function ReservationFormDrawer({
  open,
  reservation,
  unitOptions,
  customerOptions,
  staffOptions,
  defaultCurrency,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: ReservationFormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title="Edit reservation"
      subtitle={reservation?.unitName}
      ariaLabel="Edit reservation"
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <ReservationFormFields
          reservation={reservation}
          unitOptions={unitOptions}
          customerOptions={customerOptions}
          staffOptions={staffOptions}
          defaultCurrency={defaultCurrency}
          fieldErrors={fieldErrors}
        />

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
