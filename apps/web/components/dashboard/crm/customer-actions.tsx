"use client";

import { RowActionsMenu } from "../ui/row-actions";

/* Per-row actions for a customer. "View profile" opens the drawer; the rest
   are UI placeholders. */
export function CustomerActions({ onView }: { onView: () => void }) {
  return (
    <RowActionsMenu
      label="Customer actions"
      actions={[
        { label: "View profile", onSelect: onView },
        { label: "New booking", onSelect: () => {} },
        { label: "Send message", onSelect: () => {} },
        { label: "Delete customer", onSelect: () => {}, danger: true },
      ]}
    />
  );
}
