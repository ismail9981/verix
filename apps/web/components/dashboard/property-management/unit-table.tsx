"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { RowActionsMenu } from "../ui/row-actions";
import { PlusIcon } from "../icons";
import { UnitIcon } from "./icons";
import { TableSkeleton } from "../ui/table-states";
import { UnitStatusPill } from "./unit-status-pill";
import { formatMoney } from "../ui/money";
import type { RentalUnitListItem } from "../../../src/server/validators/rental-unit";

interface UnitTableProps {
  units: RentalUnitListItem[];
  loading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (unit: RentalUnitListItem) => void;
  onDelete: (unit: RentalUnitListItem) => void;
  onCreate: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function UnitRow({
  unit,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  unit: RentalUnitListItem;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (unit: RentalUnitListItem) => void;
  onDelete: (unit: RentalUnitListItem) => void;
}) {
  return (
    <tr className="border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50">
      <td className="px-5 py-3">
        <p className="truncate text-sm font-medium text-white">{unit.name}</p>
        {unit.unitNumber ? <p className="text-xs text-muted">#{unit.unitNumber}</p> : null}
      </td>
      <td className="hidden px-5 py-3 text-muted capitalize sm:table-cell">{unit.unitType}</td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">
        {unit.bedrooms} bd · {unit.bathrooms} ba
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted lg:table-cell">
        {formatMoney(unit.priceCents, unit.currency)}
      </td>
      <td className="px-5 py-3">
        <UnitStatusPill status={unit.displayStatus} />
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex justify-end">
          {canEdit || canDelete ? (
            <RowActionsMenu
              label="Unit actions"
              actions={[
                ...(canEdit ? [{ label: "Edit unit", onSelect: () => onEdit(unit) }] : []),
                ...(canDelete ? [{ label: "Delete unit", onSelect: () => onDelete(unit), danger: true }] : []),
              ]}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function UnitTable({ units, loading, canEdit, canDelete, onEdit, onDelete, onCreate }: UnitTableProps) {
  return (
    <SectionCard
      id="units"
      title="Rental units"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">
            {units.length} {units.length === 1 ? "result" : "results"}
          </span>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : units.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
            <UnitIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-white">No units yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Add your first rental unit to start taking reservations.
          </p>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              className={`${CTA_SECONDARY} mt-4`}
              leftIcon={<PlusIcon className="h-4 w-4" />}
              onClick={onCreate}
            >
              Add unit
            </Button>
          ) : null}
        </div>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Rental units</caption>
          <thead>
            <tr className="border-y border-hairline text-left text-xs text-muted">
              <th scope="col" className={TH}>Name</th>
              <th scope="col" className={`hidden sm:table-cell ${TH}`}>Type</th>
              <th scope="col" className={`hidden md:table-cell ${TH}`}>Beds/Baths</th>
              <th scope="col" className={`hidden lg:table-cell ${TH}`}>Rate</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <UnitRow key={unit.id} unit={unit} canEdit={canEdit} canDelete={canDelete} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
