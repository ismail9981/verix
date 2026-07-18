"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { FieldTextarea } from "../business-profile/field-textarea";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { HousekeepingTaskListItem } from "../../../src/server/validators/housekeeping";

interface HousekeepingCompleteDrawerProps {
  open: boolean;
  task: HousekeepingTaskListItem | null;
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

/**
 * Completing a task optionally updates its notes — pre-filled with the
 * task's current notes, so leaving the field untouched submits it back
 * unchanged, while clearing it entirely submits an explicit empty value
 * (persisted as `null`, distinct from "not touched" — see
 * `clearableNotes` in `validators/housekeeping.ts`).
 */
export function HousekeepingCompleteDrawer({
  open,
  task,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: HousekeepingCompleteDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <DetailDrawer open={open} onClose={onClose} title="Complete task" subtitle={task?.title} ariaLabel="Complete housekeeping task" size="md">
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex flex-col gap-1.5">
          <FieldTextarea label="Notes" name="notes" rows={4} defaultValue={task?.notes ?? ""} />
          {fieldErrors.notes?.[0] ? <p className="text-xs text-red-400">{fieldErrors.notes[0]}</p> : null}
        </div>
        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            Complete task
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
