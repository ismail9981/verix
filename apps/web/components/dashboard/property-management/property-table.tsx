"use client";

import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { Badge } from "../ui/badge";
import { PlusIcon } from "../icons";
import { PropertyIcon } from "./icons";
import { TableEmptyState, TableSkeleton } from "../ui/table-states";
import { PropertyActions } from "./property-actions";
import type { PropertyListItem } from "../../../src/server/validators/property";

interface PropertyTableProps {
  properties: PropertyListItem[];
  loading: boolean;
  filtersActive: boolean;
  canEdit: boolean;
  canArchive: boolean;
  onEdit: (property: PropertyListItem) => void;
  onArchive: (property: PropertyListItem) => void;
  onClearFilters: () => void;
  onCreate: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function locationLine(property: PropertyListItem): string {
  return [property.city, property.state].filter(Boolean).join(", ") || "—";
}

function PropertyRow({
  property,
  canEdit,
  canArchive,
  onEdit,
  onArchive,
}: {
  property: PropertyListItem;
  canEdit: boolean;
  canArchive: boolean;
  onEdit: (property: PropertyListItem) => void;
  onArchive: (property: PropertyListItem) => void;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(`/property-management/${property.id}`)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <p className="truncate text-sm font-medium text-white">{property.name}</p>
      </td>
      <td className="hidden px-5 py-3 text-muted sm:table-cell">{locationLine(property)}</td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">{property.buildingCount}</td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">{property.unitCount}</td>
      <td className="px-5 py-3">
        <Badge tone={property.archivedAt ? "neutral" : "success"}>
          {property.archivedAt ? "Archived" : "Active"}
        </Badge>
      </td>
      <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <PropertyActions
            canEdit={canEdit}
            canArchive={canArchive && !property.archivedAt}
            onEdit={() => onEdit(property)}
            onArchive={() => onArchive(property)}
          />
        </div>
      </td>
    </tr>
  );
}

export function PropertyTable({
  properties,
  loading,
  filtersActive,
  canEdit,
  canArchive,
  onEdit,
  onArchive,
  onClearFilters,
  onCreate,
}: PropertyTableProps) {
  return (
    <SectionCard
      id="properties"
      title="All properties"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">
            {properties.length} {properties.length === 1 ? "result" : "results"}
          </span>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : properties.length === 0 ? (
        filtersActive ? (
          <TableEmptyState
            icon={PropertyIcon}
            title="No properties found"
            description="No properties match your search. Try adjusting or clearing it."
            onClear={onClearFilters}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
              <PropertyIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-white">No properties yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Add your first property to start organizing buildings and units.
            </p>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                className={`${CTA_SECONDARY} mt-4`}
                leftIcon={<PlusIcon className="h-4 w-4" />}
                onClick={onCreate}
              >
                Add property
              </Button>
            ) : null}
          </div>
        )
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Properties</caption>
          <thead>
            <tr className="border-y border-hairline text-left text-xs text-muted">
              <th scope="col" className={TH}>Name</th>
              <th scope="col" className={`hidden sm:table-cell ${TH}`}>Location</th>
              <th scope="col" className={`hidden md:table-cell ${TH}`}>Buildings</th>
              <th scope="col" className={`hidden md:table-cell ${TH}`}>Units</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => (
              <PropertyRow
                key={property.id}
                property={property}
                canEdit={canEdit}
                canArchive={canArchive}
                onEdit={onEdit}
                onArchive={onArchive}
              />
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
