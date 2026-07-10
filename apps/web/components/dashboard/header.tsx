"use client";

import { HelpMenu } from "./help-menu";
import { MenuIcon } from "./icons";
import { Notifications } from "./notifications";
import { SearchBar } from "./search-bar";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";
import type { UserDisplay } from "../../src/server/auth/session";

interface HeaderProps {
  user: UserDisplay;
  onOpenMobileNav: () => void;
}

/* Sticky, glass-effect top bar. Present on every authenticated page. */
export function Header({ user, onOpenMobileNav }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/70 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <WorkspaceSwitcher />

        <div className="flex flex-1 justify-center px-2">
          <SearchBar />
        </div>

        <div className="flex items-center gap-1">
          <HelpMenu />
          <Notifications />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
