"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { HousekeepingFormFields } from "./housekeeping-form-fields";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  HousekeepingTaskListItem,
  HousekeepingUnitOption,
} from "../../../src/server/validators/housekeeping";
import type { ReservationPersonOption } from "../../../src/server/validators/reservation";

interface HousekeepingFormDrawerProps {
  open: boolean;
  task: HousekeepingTaskListItem | null;
  eligibleUnitOptions: HousekeepingUnitOption[];
  teamMemberOptions: ReservationPersonOption[];
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

/* Create + edit share this one drawer (and HousekeepingFormFields), keyed by
   the parent with `task?.id ?? "new"` to reset between opens. Uncontrolled
   (defaultValue), read via FormData on submit — a failed submission never
   resets or remounts the form, so entered values survive a validation
   error. The submit button is disabled when creating a task with no
   eligible unit to assign it to — `unitId` is required, so there's nothing a
   submit could do besides fail validation.

   On a failed submission, focuses and scrolls the first rejected field into
   view (by matching its `name` to `fieldErrors`' first key) so the visible
   per-field message (added in `HousekeepingFormFields`) is never off-screen
   or easy to miss behind just the drawer's generic toast. */
export function HousekeepingFormDrawer({
  open,
  task,
  eligibleUnitOptions,
  teamMemberOptions,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: HousekeepingFormDrawerProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const firstInvalidField = Object.keys(fieldErrors)[0];
    if (!firstInvalidField) return;
    const field = formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`);
    if (!field) return;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.focus({ preventScroll: true });
  }, [fieldErrors]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  const noEligibleUnits = !task && eligibleUnitOptions.length === 0;

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      subtitle={task?.unitName}
      ariaLabel={task ? "Edit housekeeping task" : "New housekeeping task"}
    >
      <form ref={formRef} onSubmit={handleSubmit} className="flex h-full flex-col">
        <HousekeepingFormFields
          task={task}
          eligibleUnitOptions={eligibleUnitOptions}
          teamMemberOptions={teamMemberOptions}
          fieldErrors={fieldErrors}
        />

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending} disabled={noEligibleUnits}>
            {task ? "Save changes" : "Create task"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
