"use client";

import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { Badge } from "../ui/badge";
import { RowActionsMenu } from "../ui/row-actions";
import { PlusIcon } from "../icons";
import { BuildingsIcon, ChevronDownIcon, ChevronUpIcon } from "./icons";
import { TableSkeleton } from "../ui/table-states";
import type { BuildingListItem } from "../../../src/server/validators/building";

interface BuildingTableProps {
  propertyId: string;
  buildings: BuildingListItem[];
  loading: boolean;
  canEdit: boolean;
  canArchive: boolean;
  onEdit: (building: BuildingListItem) => void;
  onArchive: (building: BuildingListItem) => void;
  onMove: (building: BuildingListItem, direction: "up" | "down") => void;
  onCreate: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function BuildingRow({
  propertyId,
  building,
  isFirst,
  isLast,
  canEdit,
  canArchive,
  onEdit,
  onArchive,
  onMove,
}: {
  propertyId: string;
  building: BuildingListItem;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  canArchive: boolean;
  onEdit: (building: BuildingListItem) => void;
  onArchive: (building: BuildingListItem) => void;
  onMove: (building: BuildingListItem, direction: "up" | "down") => void;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(`/property-management/${propertyId}/${building.id}`)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Move ${building.name} up`}
            disabled={isFirst || !canEdit}
            onClick={() => onMove(building, "up")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-white disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronUpIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Move ${building.name} down`}
            disabled={isLast || !canEdit}
            onClick={() => onMove(building, "down")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-white disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
      <td className="px-5 py-3">
        <p className="truncate text-sm font-medium text-white">{building.name}</p>
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted sm:table-cell">{building.unitCount}</td>
      <td className="px-5 py-3">
        <Badge tone={building.archivedAt ? "neutral" : "success"}>
          {building.archivedAt ? "Archived" : "Active"}
        </Badge>
      </td>
      <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          {canEdit || canArchive ? (
            <RowActionsMenu
              label="Building actions"
              actions={[
                ...(canEdit ? [{ label: "Edit building", onSelect: () => onEdit(building) }] : []),
                ...(canArchive && !building.archivedAt
                  ? [{ label: "Archive building", onSelect: () => onArchive(building), danger: true }]
                  : []),
              ]}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function BuildingTable({
  propertyId,
  buildings,
  loading,
  canEdit,
  canArchive,
  onEdit,
  onArchive,
  onMove,
  onCreate,
}: BuildingTableProps) {
  return (
    <SectionCard
      id="buildings"
      title="Buildings"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">
            {buildings.length} {buildings.length === 1 ? "result" : "results"}
          </span>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : buildings.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
            <BuildingsIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-white">No buildings yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Add your first building to start adding rental units.
          </p>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              className={`${CTA_SECONDARY} mt-4`}
              leftIcon={<PlusIcon className="h-4 w-4" />}
              onClick={onCreate}
            >
              Add building
            </Button>
          ) : null}
        </div>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Buildings</caption>
          <thead>
            <tr className="border-y border-hairline text-left text-xs text-muted">
              <th scope="col" className={TH}>
                <span className="sr-only">Order</span>
              </th>
              <th scope="col" className={TH}>Name</th>
              <th scope="col" className={`hidden sm:table-cell ${TH}`}>Units</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {buildings.map((building, index) => (
              <BuildingRow
                key={building.id}
                propertyId={propertyId}
                building={building}
                isFirst={index === 0}
                isLast={index === buildings.length - 1}
                canEdit={canEdit}
                canArchive={canArchive}
                onEdit={onEdit}
                onArchive={onArchive}
                onMove={onMove}
              />
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
