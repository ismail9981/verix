import type { Metadata } from "next";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";
import {
  getCustomerStats,
  listCustomers,
} from "../../../src/server/services/customer.service";
import { customerFiltersSchema } from "../../../src/server/validators/customer";
import { CrmManager } from "../../../components/dashboard/crm/crm-manager";

export const metadata: Metadata = {
  title: "CRM",
};

// Reads live customer data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function CrmPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = customerFiltersSchema.parse({
    search: params.q ?? "",
    status: params.status ?? "all",
  });

  const { workspaceId } = await requirePageCapability("customers.read");

  const [customers, stats] = await Promise.all([
    listCustomers(workspaceId, filters),
    getCustomerStats(workspaceId),
  ]);

  return (
    <CrmManager initialCustomers={customers} stats={stats} filters={filters} />
  );
}
