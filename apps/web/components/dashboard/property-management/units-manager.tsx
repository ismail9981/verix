"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PageHeader } from "../ui/page-header";
import { ProfileToast, type ToastState } from "../business-profile/profile-toast";
import { PlusIcon } from "../icons";
import { UnitTable } from "./unit-table";
import { UnitFormDrawer } from "./unit-form-drawer";
import {
  createRentalUnitAction,
  deleteRentalUnitAction,
  updateRentalUnitAction,
} from "../../../src/server/actions/rental-unit";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { RentalUnitListItem } from "../../../src/server/validators/rental-unit";
import type { BuildingListItem } from "../../../src/server/validators/building";
import type { PropertyListItem } from "../../../src/server/validators/property";

interface UnitsManagerProps {
  property: PropertyListItem;
  building: BuildingListItem;
  initialUnits: RentalUnitListItem[];
  defaultCurrency: string;
  role: string;
}

export function UnitsManager({ property, building, initialUnits, defaultCurrency, role }: UnitsManagerProps) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "manager";
  const canDelete = role === "owner";

  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<RentalUnitListItem | null | "new">(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  function openCreate() {
    setFieldErrors({});
    setEditing("new");
  }

  function openEdit(unit: RentalUnitListItem) {
    setFieldErrors({});
    setEditing(unit);
  }

  function closeForm() {
    setEditing(null);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result =
        editing && editing !== "new"
          ? await updateRentalUnitAction(property.id, building.id, editing.id, formData)
          : await createRentalUnitAction(property.id, building.id, formData);
      if (result.status === "success") {
        setFieldErrors({});
        setEditing(null);
        setToast({ tone: "success", message: result.message });
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setToast({ tone: "error", message: result.message });
      }
    });
  }

  function handleDelete(unit: RentalUnitListItem) {
    startTransition(async () => {
      const result = await deleteRentalUnitAction(property.id, building.id, unit.id);
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
      if (result.status === "success") router.refresh();
    });
  }

  const editingUnit = editing !== "new" ? editing : null;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href={`/property-management/${property.id}`}
            className="text-xs font-medium text-muted hover:text-white"
          >
            ← {property.name}
          </Link>
        </div>
        <PageHeader
          title={building.name}
          subtitle="Rental units in this building"
          actions={
            canEdit ? (
              <Button className={CTA_PRIMARY} leftIcon={<PlusIcon className="h-4 w-4" />} onClick={openCreate}>
                Add unit
              </Button>
            ) : undefined
          }
        />
        <UnitTable
          units={initialUnits}
          loading={false}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={openEdit}
          onDelete={handleDelete}
          onCreate={openCreate}
        />
      </div>

      <UnitFormDrawer
        key={editingUnit?.id ?? (editing === "new" ? "new" : "none")}
        open={editing !== null}
        unit={editingUnit}
        defaultCurrency={defaultCurrency}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
