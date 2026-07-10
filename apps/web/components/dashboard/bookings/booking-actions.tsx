"use client";

import { RowActionsMenu } from "../ui/row-actions";

interface BookingActionsProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/* Per-row actions for a booking: view the drawer, open the edit form, or
   soft-delete. */
export function BookingActions({ onView, onEdit, onDelete }: BookingActionsProps) {
  return (
    <RowActionsMenu
      label="Booking actions"
      actions={[
        { label: "View details", onSelect: onView },
        { label: "Edit booking", onSelect: onEdit },
        { label: "Delete booking", onSelect: onDelete, danger: true },
      ]}
    />
  );
}
