import type { Metadata } from "next";
import { getAuthorizedWorkspace } from "../../../src/server/auth/workspace";
import { getHousekeepingDashboardSummary } from "../../../src/server/services/housekeeping.service";
import { DashboardHome } from "../../../components/dashboard/home/dashboard-home";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const housekeepingSummary = await getHousekeepingDashboardSummary(workspaceId, { userId, role });
  return <DashboardHome housekeepingSummary={housekeepingSummary} />;
}
