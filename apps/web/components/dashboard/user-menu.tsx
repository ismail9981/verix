"use client";

import Link from "next/link";
import { ChevronDownIcon, PaymentsIcon } from "../landing/icons";
import { LogOutIcon, SettingsIcon, UserIcon } from "./icons";
import { Popover } from "./popover";
import type { UserProfile } from "./types";

/* Placeholder signed-in user. Replaced by the session once auth is wired. */
const USER: UserProfile = {
  name: "Jordan Rivera",
  email: "owner@bloomstudio.com",
  initials: "JR",
};

const MENU_ITEMS = [
  { label: "Profile", href: "#", icon: UserIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
  { label: "Billing", href: "#", icon: PaymentsIcon },
];

function Avatar() {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent"
    >
      {USER.initials}
    </span>
  );
}

export function UserMenu() {
  return (
    <Popover
      label="Account menu"
      panelClassName="w-64"
      triggerClassName="flex items-center gap-2 rounded-lg p-1 text-white transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      trigger={
        <>
          <Avatar />
          <ChevronDownIcon className="hidden h-4 w-4 text-muted sm:block" />
        </>
      }
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-3 border-b border-hairline p-3">
            <Avatar />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{USER.name}</p>
              <p className="truncate text-xs text-muted">{USER.email}</p>
            </div>
          </div>

          <ul className="p-1.5">
            {MENU_ITEMS.map(({ label, href, icon: Icon }) => (
              <li key={label}>
                <Link
                  href={href}
                  onClick={close}
                  className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-hairline p-1.5">
            <Link
              href="/login"
              onClick={close}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <LogOutIcon className="h-4 w-4" />
              Sign out
            </Link>
          </div>
        </div>
      )}
    </Popover>
  );
}
