"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-config";
import type { NavItem } from "./types";
import { hasCapability } from "../../src/server/auth/capabilities";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarNavItemProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}

function SidebarNavItem({
  item,
  active,
  collapsed,
  onNavigate,
}: SidebarNavItemProps) {
  const { icon: Icon, label, href } = item;
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={`group flex items-center rounded-lg text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
          collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
        } ${
          active
            ? "bg-accent/10 text-white"
            : "text-muted hover:bg-surface hover:text-white"
        }`}
      >
        <Icon
          className={`h-5 w-5 shrink-0 transition-colors ${
            active ? "text-accent" : "text-muted group-hover:text-white"
          }`}
        />
        {!collapsed ? <span className="truncate">{label}</span> : null}
        {collapsed ? <span className="sr-only">{label}</span> : null}
      </Link>
    </li>
  );
}

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  role: string;
}

/* The navigation list itself — shared verbatim between the desktop sidebar
   and the mobile drawer, so there is one nav to maintain. */
export function SidebarNav({
  collapsed = false,
  onNavigate,
  role,
}: SidebarNavProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) =>
    hasCapability({ role }, item.capability),
  );
  return (
    <nav aria-label="Primary" className="flex-1 overflow-y-auto">
      <ul className="flex flex-col gap-1">
        {visibleItems.map((item) => (
          <SidebarNavItem
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
  );
}
