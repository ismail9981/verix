"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Reveal, RevealItem } from "../../landing/reveal";
import { ProfileToast, type ToastState } from "../business-profile/profile-toast";
import { FilterBar } from "../ui/filter-bar";
import { FieldInput } from "../business-profile/field-input";
import { SearchIcon } from "../icons";
import { PropertyHeader } from "./property-header";
import { PropertyStats } from "./property-stats";
import { PropertyTable } from "./property-table";
import { PropertyFormDrawer } from "./property-form-drawer";
import {
  archivePropertyAction,
  createPropertyAction,
  updatePropertyAction,
} from "../../../src/server/actions/property";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { PropertyFilters, PropertyListItem } from "../../../src/server/validators/property";
import type { PropertyManagementMetrics } from "../../../src/server/services/rental-unit.service";

interface PropertiesManagerProps {
  initialProperties: PropertyListItem[];
  metrics: PropertyManagementMetrics;
  filters: PropertyFilters;
  role: string;
}

export function PropertiesManager({
  initialProperties,
  metrics,
  filters,
  role,
}: PropertiesManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const canEdit = role === "owner" || role === "manager";
  const canArchive = role === "owner";

  const [search, setSearch] = useState(filters.search);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<PropertyListItem | null | "new">(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const navigate = useCallback(
    (nextSearch: string) => {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("q", nextSearch.trim());
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = window.setTimeout(() => navigate(search), 300);
    return () => window.clearTimeout(timer);
  }, [search, navigate]);

  const filtersActive = search.trim() !== "";

  function clearFilters() {
    setSearch("");
  }

  function openCreate() {
    setFieldErrors({});
    setEditing("new");
  }

  function openEdit(property: PropertyListItem) {
    setFieldErrors({});
    setEditing(property);
  }

  function closeForm() {
    setEditing(null);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result =
        editing && editing !== "new"
          ? await updatePropertyAction(editing.id, formData)
          : await createPropertyAction(formData);
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

  function handleArchive(property: PropertyListItem) {
    startTransition(async () => {
      const result = await archivePropertyAction(property.id);
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
      if (result.status === "success") router.refresh();
    });
  }

  const editingProperty = editing !== "new" ? editing : null;

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <PropertyHeader canCreate={canEdit} onCreate={openCreate} />
        </RevealItem>
        <RevealItem>
          <PropertyStats metrics={metrics} />
        </RevealItem>
        <RevealItem>
          <FilterBar label="Filter properties">
            <FieldInput
              label="Search"
              type="search"
              placeholder="Property name…"
              leftIcon={<SearchIcon className="h-4 w-4" />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FilterBar>
        </RevealItem>
        <RevealItem>
          <PropertyTable
            properties={initialProperties}
            loading={false}
            filtersActive={filtersActive}
            canEdit={canEdit}
            canArchive={canArchive}
            onEdit={openEdit}
            onArchive={handleArchive}
            onClearFilters={clearFilters}
            onCreate={openCreate}
          />
        </RevealItem>
      </Reveal>

      <PropertyFormDrawer
        key={editingProperty?.id ?? (editing === "new" ? "new" : "none")}
        open={editing !== null}
        property={editingProperty}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
