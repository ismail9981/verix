"use client";

import { BellIcon } from "./icons";
import { Popover } from "./popover";
import type { NotificationItem } from "./types";

/* Placeholder notifications. Replaced by a real feed later. */
const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "1",
    title: "New booking",
    description: "Amelia Chen booked a balayage for Friday 9:30.",
    time: "5m ago",
    unread: true,
  },
  {
    id: "2",
    title: "Payment received",
    description: "$240 payment from Marcus Reid was captured.",
    time: "1h ago",
    unread: true,
  },
  {
    id: "3",
    title: "AI weekly summary",
    description: "Your business insights for last week are ready.",
    time: "Yesterday",
    unread: false,
  },
];

const UNREAD = NOTIFICATIONS.filter((notification) => notification.unread).length;

export function Notifications() {
  return (
    <Popover
      label={`Notifications${UNREAD ? `, ${UNREAD} unread` : ""}`}
      panelClassName="w-80"
      triggerClassName="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      trigger={
        <>
          <BellIcon className="h-5 w-5" />
          {UNREAD ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
              {UNREAD}
            </span>
          ) : null}
        </>
      }
    >
      {() => (
        <div>
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <h2 className="text-sm font-semibold text-white">Notifications</h2>
            <span className="text-xs text-muted">{UNREAD} unread</span>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {NOTIFICATIONS.map((notification) => (
              <li
                key={notification.id}
                className="flex gap-3 border-b border-hairline px-4 py-3 last:border-0"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    notification.unread ? "bg-accent" : "bg-hairline"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {notification.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {notification.description}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">{notification.time}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-hairline p-2">
            <button
              type="button"
              className="w-full rounded-lg px-3 py-2 text-center text-sm font-medium text-accent transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}
