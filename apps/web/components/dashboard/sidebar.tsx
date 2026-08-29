"use client";

import Link from "next/link";
import { Logo } from "../landing/logo";
import { PanelLeftIcon } from "./icons";
import { HOME_HREF } from "./nav-config";
import { SidebarNav } from "./sidebar-nav";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  role: string;
}

/* Desktop sidebar (lg+). Width animates between collapsed / expanded; the
   mobile drawer reuses <SidebarNav> rather than this chrome. */
export function Sidebar({ collapsed, onToggleCollapse, role }: SidebarProps) {
  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-hairline bg-canvas transition-[width] duration-200 lg:flex ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      <div
        className={`flex h-16 items-center border-b border-hairline ${
          collapsed ? "justify-center px-2" : "px-5"
        }`}
      >
        <Link
          href={HOME_HREF}
          aria-label="Verix dashboard"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Logo showWordmark={!collapsed} />
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <SidebarNav collapsed={collapsed} role={role} />
      </div>

      <div className="border-t border-hairline p-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-pressed={collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex w-full items-center rounded-lg text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
          }`}
        >
          <PanelLeftIcon className="h-5 w-5 shrink-0" />
          {!collapsed ? <span>Collapse</span> : null}
          <span className="sr-only">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </span>
        </button>
      </div>
    </aside>
  );
}
