"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { BuildingFormFields } from "./building-form-fields";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { BuildingListItem } from "../../../src/server/validators/building";

interface BuildingFormDrawerProps {
  open: boolean;
  building: BuildingListItem | null;
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

export function BuildingFormDrawer({
  open,
  building,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: BuildingFormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={building ? "Edit building" : "New building"}
      ariaLabel={building ? "Edit building" : "New building"}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <BuildingFormFields building={building} fieldErrors={fieldErrors} />

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {building ? "Save changes" : "Create building"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
