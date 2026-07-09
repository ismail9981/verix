"use client";

import { Popover } from "../popover";
import { MoreIcon } from "../bookings/icons";

/* Per-row actions menu, built on the shared Popover. "View profile" opens the
   drawer; the rest are UI placeholders. */
export function CustomerActions({ onView }: { onView: () => void }) {
  const items = [
    { label: "View profile", onClick: (close: () => void) => { onView(); close(); } },
    { label: "New booking", onClick: (close: () => void) => close() },
    { label: "Send message", onClick: (close: () => void) => close() },
  ];

  return (
    <Popover
      label="Customer actions"
      align="end"
      panelClassName="w-44"
      triggerClassName="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      trigger={<MoreIcon className="h-5 w-5" />}
    >
      {(close) => (
        <ul className="p-1.5">
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => item.onClick(close)}
                className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {item.label}
              </button>
            </li>
          ))}
          <li className="my-1 h-px bg-hairline" />
          <li>
            <button
              type="button"
              onClick={close}
              className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-red-400 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Delete customer
            </button>
          </li>
        </ul>
      )}
    </Popover>
  );
}
