"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/reservations", label: "List" },
  { href: "/reservations/calendar", label: "Calendar" },
];

/* Lightweight sub-nav distinguishing the Reservations module's two surfaces:
   the filterable list (default) and the Sprint 11 calendar view. */
export function ReservationsNavTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Reservations sections" className="flex gap-1 border-b border-hairline">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              active ? "border-accent text-white" : "border-transparent text-muted hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
