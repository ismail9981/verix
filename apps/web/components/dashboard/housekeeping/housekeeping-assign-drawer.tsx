"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { FieldSelect } from "../business-profile/field-select";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { HousekeepingTaskListItem } from "../../../src/server/validators/housekeeping";
import type { ReservationPersonOption } from "../../../src/server/validators/reservation";

interface HousekeepingAssignDrawerProps {
  open: boolean;
  task: HousekeepingTaskListItem | null;
  teamMemberOptions: ReservationPersonOption[];
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

export function HousekeepingAssignDrawer({
  open,
  task,
  teamMemberOptions,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: HousekeepingAssignDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <DetailDrawer open={open} onClose={onClose} title="Assign task" subtitle={task?.title} ariaLabel="Assign housekeeping task" size="md">
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex flex-col gap-1.5">
          <FieldSelect
            label="Team member"
            name="assignedTo"
            options={[{ value: "", label: "Select a team member" }, ...teamMemberOptions.map((m) => ({ value: m.id, label: m.name }))]}
            defaultValue={task?.assignedTo ?? ""}
          />
          {fieldErrors.assignedTo?.[0] ? <p className="text-xs text-red-400">{fieldErrors.assignedTo[0]}</p> : null}
        </div>
        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            Assign
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
