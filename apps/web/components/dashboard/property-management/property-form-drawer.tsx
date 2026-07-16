"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { PropertyFormFields } from "./property-form-fields";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { PropertyListItem } from "../../../src/server/validators/property";

interface PropertyFormDrawerProps {
  open: boolean;
  property: PropertyListItem | null;
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

/* Create + edit in one drawer (unlike Reservations, which uses a dedicated
   /reservations/new page) — a property has no cross-references to resolve
   before creation (no unit/customer/staff selectors), so a lightweight drawer
   is simpler here. Uncontrolled (defaultValue), read via FormData. */
export function PropertyFormDrawer({
  open,
  property,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: PropertyFormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={property ? "Edit property" : "New property"}
      ariaLabel={property ? "Edit property" : "New property"}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <PropertyFormFields property={property} fieldErrors={fieldErrors} />

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {property ? "Save changes" : "Create property"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
