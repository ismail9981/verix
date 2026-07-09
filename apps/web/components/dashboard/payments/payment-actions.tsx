"use client";

import { RowActionsMenu } from "../ui/row-actions";

/* Per-row actions for a payment. "View details" opens the drawer; the rest
   are UI placeholders. */
export function PaymentActions({ onView }: { onView: () => void }) {
  return (
    <RowActionsMenu
      label="Payment actions"
      actions={[
        { label: "View details", onSelect: onView },
        { label: "Download invoice", onSelect: () => {} },
        { label: "Send reminder", onSelect: () => {} },
        { label: "Refund payment", onSelect: () => {}, danger: true },
      ]}
    />
  );
}
