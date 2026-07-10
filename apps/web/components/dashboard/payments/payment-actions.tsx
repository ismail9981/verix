"use client";

import { RowActionsMenu } from "../ui/row-actions";

interface PaymentActionsProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/* Per-row actions for a payment: view the drawer, open the edit form, or
   soft-delete. */
export function PaymentActions({ onView, onEdit, onDelete }: PaymentActionsProps) {
  return (
    <RowActionsMenu
      label="Payment actions"
      actions={[
        { label: "View details", onSelect: onView },
        { label: "Edit payment", onSelect: onEdit },
        { label: "Delete payment", onSelect: onDelete, danger: true },
      ]}
    />
  );
}
