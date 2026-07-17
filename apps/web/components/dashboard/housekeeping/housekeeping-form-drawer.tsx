"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { HousekeepingFormFields } from "./housekeeping-form-fields";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { HousekeepingTaskListItem } from "../../../src/server/validators/housekeeping";
import type { RentalUnitOption } from "../../../src/server/validators/rental-unit";
import type { ReservationPersonOption } from "../../../src/server/validators/reservation";

interface HousekeepingFormDrawerProps {
  open: boolean;
  task: HousekeepingTaskListItem | null;
  unitOptions: RentalUnitOption[];
  teamMemberOptions: ReservationPersonOption[];
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

/* Create + edit share this one drawer (and HousekeepingFormFields), keyed by
   the parent with `task?.id ?? "new"` to reset between opens. Uncontrolled
   (defaultValue), read via FormData on submit. */
export function HousekeepingFormDrawer({
  open,
  task,
  unitOptions,
  teamMemberOptions,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: HousekeepingFormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      subtitle={task?.unitName}
      ariaLabel={task ? "Edit housekeeping task" : "New housekeeping task"}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <HousekeepingFormFields
          task={task}
          unitOptions={unitOptions}
          teamMemberOptions={teamMemberOptions}
          fieldErrors={fieldErrors}
        />

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {task ? "Save changes" : "Create task"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
