import type { Metadata } from "next";
import { getAuthorizedWorkspace } from "../../../src/server/auth/workspace";
import { listProperties } from "../../../src/server/services/property.service";
import { getPropertyManagementMetrics } from "../../../src/server/services/rental-unit.service";
import { propertyFiltersSchema } from "../../../src/server/validators/property";
import { PropertiesManager } from "../../../components/dashboard/property-management/properties-manager";

export const metadata: Metadata = {
  title: "Property Management",
};

// Reads live property/building/unit data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function PropertyManagementPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = propertyFiltersSchema.parse({ search: params.q ?? "" });

  const { workspaceId, role } = await getAuthorizedWorkspace();

  const [properties, metrics] = await Promise.all([
    listProperties(workspaceId, filters),
    getPropertyManagementMetrics(workspaceId),
  ]);

  return (
    <PropertiesManager
      initialProperties={properties}
      metrics={metrics}
      filters={filters}
      role={role}
    />
  );
}
