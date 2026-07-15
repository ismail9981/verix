"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/crm", label: "Customers" },
  { href: "/crm/pipeline", label: "Pipeline" },
];

/* Lightweight sub-nav distinguishing the CRM module's two surfaces: the
   Customers list (pre-existing) and the Sprint 10 sales Pipeline. */
export function CrmNavTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="CRM sections" className="flex gap-1 border-b border-hairline">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              active
                ? "border-accent text-white"
                : "border-transparent text-muted hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
