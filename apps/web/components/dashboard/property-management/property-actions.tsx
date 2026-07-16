"use client";

import { RowActionsMenu } from "../ui/row-actions";

interface PropertyActionsProps {
  onEdit: () => void;
  onArchive: () => void;
  canEdit: boolean;
  canArchive: boolean;
}

/* Per-row actions for a property: edit (manager-or-owner) or archive (owner-only). Hidden entirely for employees (read-only). */
export function PropertyActions({ onEdit, onArchive, canEdit, canArchive }: PropertyActionsProps) {
  if (!canEdit && !canArchive) return null;
  return (
    <RowActionsMenu
      label="Property actions"
      actions={[
        ...(canEdit ? [{ label: "Edit property", onSelect: onEdit }] : []),
        ...(canArchive ? [{ label: "Archive property", onSelect: onArchive, danger: true }] : []),
      ]}
    />
  );
}
