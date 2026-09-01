import type { ReactNode } from "react";
import { logoutAction } from "../../src/server/actions/auth";
import type { PlatformAdminRole } from "../../src/server/auth/platform-capabilities";
import type { PlatformNavigationItem } from "../../src/server/auth/platform-navigation";
import type { UserDisplay } from "../../src/server/auth/session";
import { AdminNav } from "./admin-nav";

function roleLabel(role: PlatformAdminRole): string {
  return role === "super_admin" ? "Super Admin" : "Support Admin";
}

export function AdminShell({
  children,
  role,
  user,
  navigation,
}: {
  children: ReactNode;
  role: PlatformAdminRole;
  user: UserDisplay;
  navigation: readonly PlatformNavigationItem[];
}) {
  return (
    <div className="min-h-screen bg-[#080b12] text-slate-100">
      <header className="border-b border-amber-300/15 bg-[#0d111b]">
        <div className="mx-auto flex min-h-16 max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
              Verix Platform
            </p>
            <p className="text-sm text-slate-400">Administration console</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-100">{user.name}</p>
              <p className="text-xs text-slate-400">
                Platform context · {roleLabel(role)}
              </p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-screen-2xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-xl border border-white/10 bg-[#0d111b] p-3 lg:min-h-[calc(100vh-7rem)]">
          <div className="mb-3 border-b border-white/10 px-3 pb-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Platform Admin
            </p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {roleLabel(role)}
            </p>
          </div>
          <AdminNav items={navigation} />
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
