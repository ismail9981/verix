import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";
import { getDashboardAnalytics } from "../../../src/server/services/dashboard-analytics.service";
import { getHousekeepingDashboardSummary } from "../../../src/server/services/housekeeping.service";
import { dashboardAnalyticsFiltersSchema } from "../../../src/server/validators/dashboard-analytics";
import { DashboardHome } from "../../../components/dashboard/home/dashboard-home";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsed = dashboardAnalyticsFiltersSchema.safeParse({
    range: params.range ?? "30d",
    from: params.from ?? "",
    to: params.to ?? "",
  });
  if (!parsed.success) redirect("/dashboard?range=30d");
  const filters = parsed.data;

  const { workspaceId, userId, role } = await requirePageCapability(
    "reports.operational.read",
  );
  const actor = { userId, role };

  // Housekeeping's summary is unaffected by the analytics date-range filter
  // (always "right now"), so it's fetched separately alongside — not part
  // of `getDashboardAnalytics`, matching how it was already wired before
  // this sprint.
  const [analytics, housekeepingSummary] = await Promise.all([
    getDashboardAnalytics(workspaceId, actor, filters),
    getHousekeepingDashboardSummary(workspaceId, actor),
  ]);

  return (
    <DashboardHome
      analytics={analytics}
      range={filters.range}
      from={filters.from ?? ""}
      to={filters.to ?? ""}
      housekeepingSummary={housekeepingSummary}
    />
  );
}
