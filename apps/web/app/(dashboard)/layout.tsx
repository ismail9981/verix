import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { requireUser, toUserDisplay } from "../../src/server/auth/session";

/* Applied to every authenticated route in this group. The title template
   lets each page set only its own name (e.g. "CRM · Verix"). */
export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s · Verix",
  },
};

// Server-side gate (defense in depth alongside the middleware): every route in
// this group requires a signed-in user, or it redirects to /login.
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  return (
    <DashboardShell user={toUserDisplay(user)}>{children}</DashboardShell>
  );
}
