"use client";

import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { FieldTextarea } from "../business-profile/field-textarea";
import { taskTypeLabel, priorityLabel } from "./task-format";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import {
  HOUSEKEEPING_TASK_PRIORITIES,
  HOUSEKEEPING_TASK_TYPES,
  type HousekeepingTaskListItem,
} from "../../../src/server/validators/housekeeping";
import type { RentalUnitOption } from "../../../src/server/validators/rental-unit";
import type { ReservationPersonOption } from "../../../src/server/validators/reservation";

const TASK_TYPE_OPTIONS = HOUSEKEEPING_TASK_TYPES.map((value) => ({ value, label: taskTypeLabel(value) }));
const PRIORITY_OPTIONS = HOUSEKEEPING_TASK_PRIORITIES.map((value) => ({ value, label: priorityLabel(value) }));

interface HousekeepingFormFieldsProps {
  task: HousekeepingTaskListItem | null;
  unitOptions: RentalUnitOption[];
  teamMemberOptions: ReservationPersonOption[];
  fieldErrors: FieldErrors;
}

/* Shared field markup for both create and edit — the unit picker is
   disabled (but still submitted via a hidden input) once a task exists,
   since a task's unit is immutable after creation (see
   `housekeeping.service.ts`'s `updateHousekeepingTask`). "Assign to" only
   appears when creating: reassigning an existing task afterward goes
   through the single dedicated "Assign" control on the detail page (see
   `assignHousekeepingTask`), not this general edit form. */
export function HousekeepingFormFields({
  task,
  unitOptions,
  teamMemberOptions,
  fieldErrors,
}: HousekeepingFormFieldsProps) {
  const unitSelect = [
    { value: "", label: "Select a unit" },
    ...unitOptions.map((u) => ({ value: u.id, label: u.name })),
  ];
  const assigneeSelect = [
    { value: "", label: "Unassigned" },
    ...teamMemberOptions.map((m) => ({ value: m.id, label: m.name })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        {task ? (
          <>
            <FieldSelect label="Unit" options={[{ value: task.unitId, label: task.unitName }]} value={task.unitId} disabled />
            <input type="hidden" name="unitId" value={task.unitId} />
            <p className="text-xs text-muted">A task&apos;s unit can&apos;t be changed after creation.</p>
          </>
        ) : (
          <FieldSelect label="Unit" name="unitId" options={unitSelect} defaultValue="" />
        )}
        {fieldErrors.unitId?.[0] ? <p className="text-xs text-red-400">{fieldErrors.unitId[0]}</p> : null}
      </div>

      {!task ? <FieldSelect label="Assign to" name="assignedTo" options={assigneeSelect} defaultValue="" /> : null}

      <div className="flex flex-col gap-1.5">
        <FieldInput
          label="Title"
          name="title"
          required
          maxLength={120}
          defaultValue={task?.title ?? ""}
          error={fieldErrors.title?.[0]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldSelect
          label="Task type"
          name="taskType"
          options={TASK_TYPE_OPTIONS}
          defaultValue={task?.taskType ?? "cleaning"}
        />
        <FieldSelect
          label="Priority"
          name="priority"
          options={PRIORITY_OPTIONS}
          defaultValue={task?.priority ?? "normal"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldInput label="Due date" name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} />
        <FieldInput label="Due time" name="dueTime" type="time" defaultValue={task?.dueTime ?? ""} />
      </div>

      <FieldTextarea label="Description" name="description" rows={3} defaultValue={task?.description ?? ""} />
      <FieldTextarea label="Notes" name="notes" rows={3} defaultValue={task?.notes ?? ""} />
    </div>
  );
}
