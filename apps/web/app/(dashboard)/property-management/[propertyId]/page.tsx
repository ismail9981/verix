import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthorizedWorkspace } from "../../../../src/server/auth/workspace";
import { getProperty } from "../../../../src/server/services/property.service";
import { listBuildings } from "../../../../src/server/services/building.service";
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

  const property = await getProperty(workspaceId, propertyId).catch(() => null);
  if (!property) notFound();

  const buildings = await listBuildings(workspaceId, propertyId);

  return <BuildingsManager property={property} initialBuildings={buildings} role={role} />;
}
