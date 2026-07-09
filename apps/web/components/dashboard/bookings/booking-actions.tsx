"use client";

import { RowActionsMenu } from "../ui/row-actions";

/* Per-row actions for a booking. "View details" opens the drawer; the rest
   are UI placeholders. */
export function BookingActions({ onView }: { onView: () => void }) {
  return (
    <RowActionsMenu
      label="Booking actions"
      actions={[
        { label: "View details", onSelect: onView },
        { label: "Edit booking", onSelect: () => {} },
        { label: "Reschedule", onSelect: () => {} },
        { label: "Cancel booking", onSelect: () => {}, danger: true },
      ]}
    />
  );
}
