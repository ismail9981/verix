"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer, DrawerSectionTitle } from "../detail-drawer";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { FieldTextarea } from "../business-profile/field-textarea";
import { RowActionsMenu } from "../ui/row-actions";
import { Badge } from "../ui/badge";
import { formatMoney } from "./reservation-format";
import { ProfileToast, type ToastState } from "../business-profile/profile-toast";
import {
  createRentalUnitAction,
  deleteRentalUnitAction,
  updateRentalUnitAction,
} from "../../../src/server/actions/rental-unit";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { RentalUnitListItem } from "../../../src/server/validators/rental-unit";

const UNIT_TYPE_OPTIONS = [
  { value: "room", label: "Room" },
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "other", label: "Other" },
];

const UNIT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

interface UnitManagerDrawerProps {
  open: boolean;
  units: RentalUnitListItem[];
  defaultCurrency: string;
  onClose: () => void;
}

export function UnitManagerDrawer({ open, units, defaultCurrency, onClose }: UnitManagerDrawerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<RentalUnitListItem | null | "new">(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result =
        editing && editing !== "new"
          ? await updateRentalUnitAction(editing.id, formData)
          : await createRentalUnitAction(formData);
      if (result.status === "success") {
        setFieldErrors({});
        setEditing(null);
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
      }
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
    });
  }

  function handleDelete(unit: RentalUnitListItem) {
    startTransition(async () => {
      const result = await deleteRentalUnitAction(unit.id);
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
      if (result.status === "success") router.refresh();
    });
  }

  const showForm = editing !== null;
  const editingUnit = editing !== "new" ? editing : null;

  return (
    <DetailDrawer open={open} onClose={onClose} title="Manage units" ariaLabel="Manage units" size="lg">
      <div className="flex flex-col gap-6">
        {showForm ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <DrawerSectionTitle>{editingUnit ? "Edit unit" : "New unit"}</DrawerSectionTitle>
            <FieldInput
              label="Name"
              name="name"
              required
              defaultValue={editingUnit?.name ?? ""}
              error={fieldErrors.name?.[0]}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldSelect label="Type" name="unitType" options={UNIT_TYPE_OPTIONS} defaultValue={editingUnit?.unitType ?? "room"} />
              <FieldInput
                label="Capacity"
                name="capacity"
                type="number"
                min={1}
                required
                defaultValue={editingUnit ? String(editingUnit.capacity) : "1"}
                error={fieldErrors.capacity?.[0]}
              />
            </div>
            <FieldInput
              label={`Default rate (${(editingUnit?.currency ?? defaultCurrency).toUpperCase()})`}
              name="amount"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={editingUnit ? String(editingUnit.priceCents / 100) : ""}
              error={fieldErrors.amount?.[0]}
              helperText="Priced in the workspace's currency, set in Settings."
            />
            <FieldSelect label="Status" name="status" options={UNIT_STATUS_OPTIONS} defaultValue={editingUnit?.status ?? "active"} />
            <FieldTextarea label="Description" name="description" rows={2} defaultValue={editingUnit?.description ?? ""} />

            <div className="mt-2 flex items-center justify-end gap-3">
              <Button type="button" className={CTA_SECONDARY} onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" className={CTA_PRIMARY} loading={isPending}>
                {editingUnit ? "Save changes" : "Create unit"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <Button type="button" className={CTA_PRIMARY} onClick={() => setEditing("new")}>
              Add unit
            </Button>
            <div className="flex flex-col divide-y divide-hairline">
              {units.length === 0 ? (
                <p className="py-4 text-sm text-muted">No units yet. Add your first unit to start taking reservations.</p>
              ) : (
                units.map((unit) => (
                  <div key={unit.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{unit.name}</p>
                      <p className="text-xs text-muted">
                        {unit.unitType} · capacity {unit.capacity} · {formatMoney(unit.priceCents, unit.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={unit.status === "active" ? "success" : "neutral"}>{unit.status}</Badge>
                      <RowActionsMenu
                        label="Unit actions"
                        actions={[
                          { label: "Edit unit", onSelect: () => setEditing(unit) },
                          { label: "Delete unit", onSelect: () => handleDelete(unit), danger: true },
                        ]}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <ProfileToast toast={toast} onDismiss={() => setToast(null)} />
    </DetailDrawer>
  );
}
