import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "../../../components/platform-admin/admin-shell";
import { requirePlatformPageCapability } from "../../../src/server/auth/platform-page-authorization";
import { platformNavigationFor } from "../../../src/server/auth/platform-navigation";
import { requireUser, toUserDisplay } from "../../../src/server/auth/session";

export const metadata: Metadata = {
  title: {
    default: "Platform Admin",
    template: "%s · Verix Platform",
  },
  robots: { index: false, follow: false },
};

/** Server-owned gate shared by every route nested beneath /admin. */
export default async function PlatformAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requirePlatformPageCapability(
    "platform.workspaces.read",
  );
  const user = await requireUser();
  return (
    <AdminShell
      role={context.role}
      user={toUserDisplay(user)}
      navigation={platformNavigationFor(context)}
    >
      {children}
    </AdminShell>
  );
}
