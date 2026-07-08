import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardShell } from "../../components/dashboard/dashboard-shell";

/* Applied to every authenticated route in this group. The title template
   lets each page set only its own name (e.g. "CRM · Verix"). */
export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s · Verix",
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
