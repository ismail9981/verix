import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthorizedWorkspace } from "../../../../../src/server/auth/workspace";
import { db } from "../../../../../src/server/db/db";
import { getProperty } from "../../../../../src/server/services/property.service";
import { getBuilding } from "../../../../../src/server/services/building.service";
import {
  getWorkspaceCurrency,
  listRentalUnits,
} from "../../../../../src/server/services/rental-unit.service";
import { UnitsManager } from "../../../../../components/dashboard/property-management/units-manager";

export const metadata: Metadata = {
  title: "Building",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ propertyId: string; buildingId: string }>;
}

export default async function BuildingDetailPage({ params }: PageProps) {
  const { propertyId, buildingId } = await params;
  const { workspaceId, role } = await getAuthorizedWorkspace();

  const property = await getProperty(workspaceId, propertyId).catch(() => null);
  if (!property) notFound();

  const building = await getBuilding(workspaceId, propertyId, buildingId).catch(() => null);
  if (!building) notFound();

  const [units, defaultCurrency] = await Promise.all([
    listRentalUnits(workspaceId, { status: "all", buildingId }),
    getWorkspaceCurrency(db, workspaceId),
  ]);

  return (
    <UnitsManager
      property={property}
      building={building}
      initialUnits={units}
      defaultCurrency={defaultCurrency}
      role={role}
    />
  );
}
