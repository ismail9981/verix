"use client";

import Link from "next/link";
import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { FieldTextarea } from "../business-profile/field-textarea";
import { taskTypeLabel, priorityLabel } from "./task-format";
import { SparkleIcon } from "./icons";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import {
  HOUSEKEEPING_TASK_PRIORITIES,
  HOUSEKEEPING_TASK_TYPES,
  type HousekeepingTaskListItem,
  type HousekeepingUnitOption,
} from "../../../src/server/validators/housekeeping";
import type { ReservationPersonOption } from "../../../src/server/validators/reservation";

const TASK_TYPE_OPTIONS = HOUSEKEEPING_TASK_TYPES.map((value) => ({ value, label: taskTypeLabel(value) }));
const PRIORITY_OPTIONS = HOUSEKEEPING_TASK_PRIORITIES.map((value) => ({ value, label: priorityLabel(value) }));

/** `"Property / Building — Unit"` — disambiguates similarly-named units across a workspace's portfolio in a flat <select> (no <optgroup> support in the shared FieldSelect). */
function unitOptionLabel(unit: HousekeepingUnitOption): string {
  return `${unit.propertyName} / ${unit.buildingName} — ${unit.name}`;
}

interface HousekeepingFormFieldsProps {
  task: HousekeepingTaskListItem | null;
  eligibleUnitOptions: HousekeepingUnitOption[];
  teamMemberOptions: ReservationPersonOption[];
  fieldErrors: FieldErrors;
}

/* Shared field markup for both create and edit — the unit picker is
   disabled (but still submitted via a hidden input) once a task exists,
   since a task's unit is immutable after creation (see
   `housekeeping.service.ts`'s `updateHousekeepingTask`). "Assign to" only
   appears when creating: reassigning an existing task afterward goes
   through the single dedicated "Assign" control on the detail page (see
   `assignHousekeepingTask`), not this general edit form.

   When creating and no unit is eligible (every unit is either archived, or
   its property/building is), the rest of the form is replaced by an empty
   state — there is nothing a title/type/priority would accomplish without a
   unit to attach the task to, and the parent drawer disables the submit
   button for the same reason. */
export function HousekeepingFormFields({
  task,
  eligibleUnitOptions,
  teamMemberOptions,
  fieldErrors,
}: HousekeepingFormFieldsProps) {
  if (!task && eligibleUnitOptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
          <SparkleIcon className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium text-white">No eligible units</p>
        <p className="max-w-xs text-sm text-muted">
          Every unit is either archived or has no active property/building. Add a unit in Property
          Management before creating a housekeeping task.
        </p>
        <Link href="/property-management">
          <Button type="button" size="sm" className={`${CTA_SECONDARY} mt-1`}>
            Go to Property Management
          </Button>
        </Link>
      </div>
    );
  }

  const unitSelect = [
    { value: "", label: "Select a unit" },
    ...eligibleUnitOptions.map((u) => ({ value: u.id, label: unitOptionLabel(u) })),
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
          <FieldSelect label="Unit" name="unitId" options={unitSelect} defaultValue="" required />
        )}
        {fieldErrors.unitId?.[0] ? <p className="text-xs text-red-400">{fieldErrors.unitId[0]}</p> : null}
      </div>

      {!task ? (
        <div className="flex flex-col gap-1.5">
          <FieldSelect label="Assign to" name="assignedTo" options={assigneeSelect} defaultValue="" />
          {fieldErrors.assignedTo?.[0] ? (
            <p className="text-xs text-red-400">{fieldErrors.assignedTo[0]}</p>
          ) : null}
        </div>
      ) : null}

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
        <div className="flex flex-col gap-1.5">
          <FieldSelect
            label="Task type"
            name="taskType"
            options={TASK_TYPE_OPTIONS}
            defaultValue={task?.taskType ?? "cleaning"}
          />
          {fieldErrors.taskType?.[0] ? <p className="text-xs text-red-400">{fieldErrors.taskType[0]}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldSelect
            label="Priority"
            name="priority"
            options={PRIORITY_OPTIONS}
            defaultValue={task?.priority ?? "normal"}
          />
          {fieldErrors.priority?.[0] ? <p className="text-xs text-red-400">{fieldErrors.priority[0]}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldInput
          label="Due date"
          name="dueDate"
          type="date"
          defaultValue={task?.dueDate ?? ""}
          error={fieldErrors.dueDate?.[0]}
        />
        <FieldInput
          label="Due time"
          name="dueTime"
          type="time"
          defaultValue={task?.dueTime ?? ""}
          error={fieldErrors.dueTime?.[0]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldTextarea label="Description" name="description" rows={3} defaultValue={task?.description ?? ""} />
        {fieldErrors.description?.[0] ? (
          <p className="text-xs text-red-400">{fieldErrors.description[0]}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldTextarea label="Notes" name="notes" rows={3} defaultValue={task?.notes ?? ""} />
        {fieldErrors.notes?.[0] ? <p className="text-xs text-red-400">{fieldErrors.notes[0]}</p> : null}
      </div>
    </div>
  );
}
