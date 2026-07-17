import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthorizedWorkspace } from "../../../../src/server/auth/workspace";
import { getProperty } from "../../../../src/server/services/property.service";
import { listBuildings } from "../../../../src/server/services/building.service";
import { NotFoundError } from "../../../../src/server/services/errors";
import { BuildingsManager } from "../../../../components/dashboard/property-management/buildings-manager";

export const metadata: Metadata = {
  title: "Property",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ propertyId: string }>;
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { propertyId } = await params;
  const { workspaceId, role } = await getAuthorizedWorkspace();

  let property;
  try {
    property = await getProperty(workspaceId, propertyId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const buildings = await listBuildings(workspaceId, propertyId);

  return <BuildingsManager property={property} initialBuildings={buildings} role={role} />;
}
