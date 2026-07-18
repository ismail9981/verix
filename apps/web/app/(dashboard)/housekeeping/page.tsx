import type { Metadata } from "next";
import { getAuthorizedWorkspace } from "../../../src/server/auth/workspace";
import {
  getHousekeepingMetrics,
  listEligibleTaskUnitOptions,
  listHousekeepingTasks,
  listHousekeepingUnitFilterOptions,
  listWorkspaceBuildingOptions,
} from "../../../src/server/services/housekeeping.service";
import { listPropertyOptions } from "../../../src/server/services/property.service";
import { listStaffOptions } from "../../../src/server/services/reservation.service";
import { housekeepingTaskFiltersSchema } from "../../../src/server/validators/housekeeping";
import { HousekeepingManager } from "../../../components/dashboard/housekeeping/housekeeping-manager";

export const metadata: Metadata = {
  title: "Housekeeping",
};

// Reads live task data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    filter?: string;
    property?: string;
    building?: string;
    unit?: string;
    due?: string;
    page?: string;
  }>;
}

export default async function HousekeepingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = housekeepingTaskFiltersSchema.parse({
    search: params.q ?? "",
    quickFilter: params.filter ?? "all",
    propertyId: params.property ?? "all",
    buildingId: params.building ?? "all",
    unitId: params.unit ?? "all",
    dueDate: params.due,
    page: params.page ?? "1",
    pageSize: "25",
  });

  const { workspaceId, userId, role } = await getAuthorizedWorkspace();
  const actor = { userId, role };

  const [
    { items, total },
    metrics,
    propertyOptions,
    buildingOptions,
    unitOptions,
    eligibleUnitOptions,
    teamMemberOptions,
  ] = await Promise.all([
    listHousekeepingTasks(workspaceId, actor, filters),
    getHousekeepingMetrics(workspaceId, actor),
    listPropertyOptions(workspaceId),
    listWorkspaceBuildingOptions(workspaceId),
    listHousekeepingUnitFilterOptions(workspaceId),
    listEligibleTaskUnitOptions(workspaceId),
    listStaffOptions(workspaceId),
  ]);

  return (
    <HousekeepingManager
      initialTasks={items}
      total={total}
      metrics={metrics}
      filters={filters}
      propertyOptions={propertyOptions}
      buildingOptions={buildingOptions}
      unitOptions={unitOptions}
      eligibleUnitOptions={eligibleUnitOptions}
      teamMemberOptions={teamMemberOptions}
      role={role}
    />
  );
}
