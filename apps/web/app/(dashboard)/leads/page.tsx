import type { Metadata } from "next";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";
import {
  getLeadStats,
  listLeads,
} from "../../../src/server/services/lead.service";
import { listSites } from "../../../src/server/services/website.service";
import { leadFiltersSchema } from "../../../src/server/validators/lead";
import { LeadManager } from "../../../components/dashboard/leads/lead-manager";

export const metadata: Metadata = {
  title: "Leads",
};

// Reads live lead data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    siteId?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = leadFiltersSchema.parse({
    search: params.q ?? "",
    status: params.status ?? "all",
    siteId: params.siteId ?? "",
    from: params.from ?? "",
    to: params.to ?? "",
  });

  const { workspaceId } = await requirePageCapability("leads.read");

  const [leads, stats, sites] = await Promise.all([
    listLeads(workspaceId, filters),
    getLeadStats(workspaceId),
    listSites(workspaceId),
  ]);

  const siteOptions = sites.map((site) => ({
    value: site.id,
    label: site.name,
  }));

  return (
    <LeadManager
      initialLeads={leads}
      stats={stats}
      filters={filters}
      siteOptions={siteOptions}
    />
  );
}
