import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthorizedWorkspace } from "../../../../../src/server/auth/workspace";
import { db } from "../../../../../src/server/db/db";
import { getProperty } from "../../../../../src/server/services/property.service";
import { getBuilding } from "../../../../../src/server/services/building.service";
import { NotFoundError } from "../../../../../src/server/services/errors";
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

  let property;
  try {
    property = await getProperty(workspaceId, propertyId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  let building;
  try {
    building = await getBuilding(workspaceId, propertyId, buildingId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

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
