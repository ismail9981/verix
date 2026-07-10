"use client";

import { RowActionsMenu } from "../ui/row-actions";

interface CustomerActionsProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/* Per-row actions for a customer: view the profile drawer, open the edit form,
   or soft-delete. */
export function CustomerActions({ onView, onEdit, onDelete }: CustomerActionsProps) {
  return (
    <RowActionsMenu
      label="Customer actions"
      actions={[
        { label: "View profile", onSelect: onView },
        { label: "Edit", onSelect: onEdit },
        { label: "Delete", onSelect: onDelete, danger: true },
      ]}
    />
  );
}
