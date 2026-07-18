"use client";

import { RowActionsMenu } from "../ui/row-actions";
import type { HousekeepingTaskListItem } from "../../../src/server/validators/housekeeping";

interface HousekeepingActionsProps {
  task: HousekeepingTaskListItem;
  canEdit: boolean;
  canAssign: boolean;
  canStart: boolean;
  canComplete: boolean;
  canCancel: boolean;
  onView: () => void;
  onEdit: () => void;
  onAssign: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
}

/* Per-row actions for a housekeeping task. Edit/cancel are owner/manager
   only; start/complete are offered whenever the state machine allows them for
   this actor (service re-validates regardless — this only controls what's
   offered). */
export function HousekeepingActions({
  task,
  canEdit,
  canAssign,
  canStart,
  canComplete,
  canCancel,
  onView,
  onEdit,
  onAssign,
  onStart,
  onComplete,
  onCancel,
}: HousekeepingActionsProps) {
  return (
    <RowActionsMenu
      label={`Actions for ${task.title}`}
      actions={[
        { label: "View details", onSelect: onView },
        ...(canStart ? [{ label: "Start task", onSelect: onStart }] : []),
        ...(canComplete ? [{ label: "Complete task", onSelect: onComplete }] : []),
        ...(canAssign ? [{ label: "Assign", onSelect: onAssign }] : []),
        ...(canEdit ? [{ label: "Edit task", onSelect: onEdit }] : []),
        ...(canCancel ? [{ label: "Cancel task", onSelect: onCancel, danger: true }] : []),
      ]}
    />
  );
}
