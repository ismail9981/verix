"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PlatformNavigationItem } from "../../src/server/auth/platform-navigation";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({
  items,
}: {
  items: readonly PlatformNavigationItem[];
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Platform administration">
      <ul className="flex gap-2 lg:flex-col">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  active
                    ? "bg-amber-400/15 text-amber-200"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
