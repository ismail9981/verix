"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Breadcrumbs } from "./breadcrumbs";
import { Header } from "./header";
import { MobileDrawer } from "./mobile-drawer";
import { Sidebar } from "./sidebar";

const COLLAPSE_KEY = "verix.sidebar.collapsed";

/* Owns the shell's client state (sidebar collapse + mobile drawer) and lays
   out the sidebar, header, breadcrumbs, and page content. Collapse state is
   persisted so it survives navigation and reloads. */
export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "true");
  }, []);

  const toggleCollapse = () =>
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });

  return (
    <div className="flex min-h-screen bg-canvas text-white">
      <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Breadcrumbs />
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
