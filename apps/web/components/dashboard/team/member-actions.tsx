"use client";

import { RowActionsMenu } from "../ui/row-actions";

interface MemberActionsProps {
  onView: () => void;
  onEdit: () => void;
  onRemove: () => void;
  canManage: boolean;
}

/* Per-row actions for a team member: view profile, edit role/status, or remove
   (soft-delete the membership). */
export function MemberActions({
  onView,
  onEdit,
  onRemove,
  canManage,
}: MemberActionsProps) {
  return (
    <RowActionsMenu
      label="Member actions"
      actions={[
        { label: "View profile", onSelect: onView },
        ...(canManage
          ? [
              { label: "Edit member", onSelect: onEdit },
              { label: "Remove member", onSelect: onRemove, danger: true },
            ]
          : []),
      ]}
    />
  );
}
