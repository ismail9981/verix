"use client";

import { RowActionsMenu } from "../ui/row-actions";

/* Per-row actions for a team member. "View profile" opens the drawer; the
   rest are UI placeholders. */
export function MemberActions({ onView }: { onView: () => void }) {
  return (
    <RowActionsMenu
      label="Member actions"
      actions={[
        { label: "View profile", onSelect: onView },
        { label: "Edit member", onSelect: () => {} },
        { label: "Manage schedule", onSelect: () => {} },
        { label: "Remove member", onSelect: () => {}, danger: true },
      ]}
    />
  );
}
