import type { Metadata } from "next";
import { getAuthorizedWorkspace } from "../../../src/server/auth/workspace";
import { getAnalytics } from "../../../src/server/services/analytics.service";
import { analyticsFiltersSchema } from "../../../src/server/validators/analytics";
import { AnalyticsManager } from "../../../components/dashboard/analytics/analytics-manager";

export const metadata: Metadata = {
  title: "Analytics",
};

// Recomputes aggregates on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}

function toDateInput(value: Date | undefined): string {
  if (!value) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = analyticsFiltersSchema.parse({
    range: params.range ?? "30d",
    from: params.from ?? "",
    to: params.to ?? "",
  });

  const { workspaceId } = await getAuthorizedWorkspace();
  const data = await getAnalytics(workspaceId, filters);

  return (
    <AnalyticsManager
      data={data}
      range={filters.range}
      from={toDateInput(filters.from)}
      to={toDateInput(filters.to)}
    />
  );
}
