"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PageHeader } from "../ui/page-header";
import {
  ProfileToast,
  type ToastState,
} from "../business-profile/profile-toast";
import { PlusIcon } from "../icons";
import { BuildingTable } from "./building-table";
import { BuildingFormDrawer } from "./building-form-drawer";
import {
  archiveBuildingAction,
  createBuildingAction,
  reorderBuildingsAction,
  updateBuildingAction,
} from "../../../src/server/actions/building";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { BuildingListItem } from "../../../src/server/validators/building";
import type { PropertyListItem } from "../../../src/server/validators/property";
import { hasCapability } from "../../../src/server/auth/capabilities";

interface BuildingsManagerProps {
  property: PropertyListItem;
  initialBuildings: BuildingListItem[];
  role: string;
}

export function BuildingsManager({
  property,
  initialBuildings,
  role,
}: BuildingsManagerProps) {
  const router = useRouter();
  const canEdit = hasCapability({ role }, "properties.manage");
  const canArchive = hasCapability({ role }, "properties.archive");

  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<BuildingListItem | null | "new">(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  function openCreate() {
    setFieldErrors({});
    setEditing("new");
  }

  function openEdit(building: BuildingListItem) {
    setFieldErrors({});
    setEditing(building);
  }

  function closeForm() {
    setEditing(null);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result =
        editing && editing !== "new"
          ? await updateBuildingAction(property.id, editing.id, formData)
          : await createBuildingAction(property.id, formData);
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

  function handleArchive(building: BuildingListItem) {
    startTransition(async () => {
      const result = await archiveBuildingAction(property.id, building.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
      if (result.status === "success") router.refresh();
    });
  }

  function handleMove(building: BuildingListItem, direction: "up" | "down") {
    const index = initialBuildings.findIndex((b) => b.id === building.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= initialBuildings.length) return;

    const reordered = [...initialBuildings];
    const tmp = reordered[index]!;
    reordered[index] = reordered[swapIndex]!;
    reordered[swapIndex] = tmp;

    startTransition(async () => {
      const result = await reorderBuildingsAction(
        property.id,
        reordered.map((b) => b.id),
      );
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
      if (result.status === "success") router.refresh();
    });
  }

  const editingBuilding = editing !== "new" ? editing : null;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/property-management"
            className="text-xs font-medium text-muted hover:text-white"
          >
            ← All properties
          </Link>
        </div>
        <PageHeader
          title={property.name}
          subtitle={
            [property.city, property.state].filter(Boolean).join(", ") ||
            "Buildings in this property"
          }
          actions={
            canEdit ? (
              <Button
                className={CTA_PRIMARY}
                leftIcon={<PlusIcon className="h-4 w-4" />}
                onClick={openCreate}
              >
                Add building
              </Button>
            ) : undefined
          }
        />
        <BuildingTable
          propertyId={property.id}
          buildings={initialBuildings}
          loading={false}
          canEdit={canEdit}
          canArchive={canArchive}
          onEdit={openEdit}
          onArchive={handleArchive}
          onMove={handleMove}
          onCreate={openCreate}
        />
      </div>

      <BuildingFormDrawer
        key={editingBuilding?.id ?? (editing === "new" ? "new" : "none")}
        open={editing !== null}
        building={editingBuilding}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
