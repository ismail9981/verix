"use client";

import { RowActionsMenu } from "../ui/row-actions";

interface ReservationActionsProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

/* Per-row actions for a reservation: view the drawer, open the edit form, or
   soft-delete. Edit/delete are hidden entirely for employees (view-only
   outside the drawer's status-transition buttons). */
export function ReservationActions({ onView, onEdit, onDelete, canEdit }: ReservationActionsProps) {
  return (
    <RowActionsMenu
      label="Reservation actions"
      actions={[
        { label: "View details", onSelect: onView },
        ...(canEdit
          ? [
              { label: "Edit reservation", onSelect: onEdit },
              { label: "Delete reservation", onSelect: onDelete, danger: true },
            ]
          : []),
      ]}
    />
  );
}
