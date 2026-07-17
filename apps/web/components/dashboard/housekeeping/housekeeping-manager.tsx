"use client";

import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Reveal, RevealItem } from "../../landing/reveal";
import { ProfileToast, type ToastState } from "../business-profile/profile-toast";
import { HousekeepingHeader } from "./housekeeping-header";
import { HousekeepingStats } from "./housekeeping-stats";
import { HousekeepingFiltersBar } from "./housekeeping-filters";
import { HousekeepingTable } from "./housekeeping-table";
import { HousekeepingFormDrawer } from "./housekeeping-form-drawer";
import { HousekeepingAssignDrawer } from "./housekeeping-assign-drawer";
import {
  assignHousekeepingTaskAction,
  cancelHousekeepingTaskAction,
  completeHousekeepingTaskAction,
  createHousekeepingTaskAction,
  startHousekeepingTaskAction,
  updateHousekeepingTaskAction,
} from "../../../src/server/actions/housekeeping";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  HousekeepingQuickFilter,
  HousekeepingTaskFilters,
  HousekeepingTaskListItem,
  HousekeepingTaskMetrics,
  HousekeepingUnitOption,
} from "../../../src/server/validators/housekeeping";
import type { PropertyOption } from "../../../src/server/validators/property";
import type { RentalUnitOption } from "../../../src/server/validators/rental-unit";
import type { ReservationPersonOption } from "../../../src/server/validators/reservation";

type OptimisticAction =
  | { type: "update"; task: HousekeepingTaskListItem }
  | { type: "remove"; id: string };

interface HousekeepingManagerProps {
  initialTasks: HousekeepingTaskListItem[];
  total: number;
  metrics: HousekeepingTaskMetrics | null;
  filters: HousekeepingTaskFilters;
  propertyOptions: PropertyOption[];
  buildingOptions: { id: string; name: string }[];
  unitOptions: RentalUnitOption[];
  eligibleUnitOptions: HousekeepingUnitOption[];
  teamMemberOptions: ReservationPersonOption[];
  role: string;
}

export function HousekeepingManager({
  initialTasks,
  total,
  metrics,
  filters,
  propertyOptions,
  buildingOptions,
  unitOptions,
  eligibleUnitOptions,
  teamMemberOptions,
  role,
}: HousekeepingManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const canManage = role === "owner" || role === "manager";

  const [tasks, applyOptimistic] = useOptimistic(initialTasks, (state, action: OptimisticAction) => {
    switch (action.type) {
      case "update":
        return state.map((t) => (t.id === action.task.id ? action.task : t));
      case "remove":
        return state.filter((t) => t.id !== action.id);
    }
  });

  const [search, setSearch] = useState(filters.search);
  const [quickFilter, setQuickFilter] = useState<HousekeepingQuickFilter>(filters.quickFilter);
  const [propertyId, setPropertyId] = useState(filters.propertyId);
  const [buildingId, setBuildingId] = useState(filters.buildingId);
  const [unitId, setUnitId] = useState(filters.unitId);
  const [dueDate, setDueDate] = useState(filters.dueDate ?? "");
  const [isPending, startTransition] = useTransition();

  const [editing, setEditing] = useState<HousekeepingTaskListItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<HousekeepingTaskListItem | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const navigate = useCallback(
    (next: {
      search: string;
      quickFilter: HousekeepingQuickFilter;
      propertyId: string;
      buildingId: string;
      unitId: string;
      dueDate: string;
      page?: number;
    }) => {
      const params = new URLSearchParams();
      if (next.search.trim()) params.set("q", next.search.trim());
      if (next.quickFilter !== "all") params.set("filter", next.quickFilter);
      if (next.propertyId !== "all") params.set("property", next.propertyId);
      if (next.buildingId !== "all") params.set("building", next.buildingId);
      if (next.unitId !== "all") params.set("unit", next.unitId);
      if (next.dueDate) params.set("due", next.dueDate);
      if (next.page && next.page > 1) params.set("page", String(next.page));
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
    const timer = window.setTimeout(
      () => navigate({ search, quickFilter, propertyId, buildingId, unitId, dueDate, page: 1 }),
      300,
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, quickFilter, propertyId, buildingId, unitId, dueDate]);

  const filtersActive =
    search.trim() !== "" ||
    quickFilter !== "all" ||
    propertyId !== "all" ||
    buildingId !== "all" ||
    unitId !== "all" ||
    dueDate !== "";

  function clearFilters() {
    setSearch("");
    setQuickFilter("all");
    setPropertyId("all");
    setBuildingId("all");
    setUnitId("all");
    setDueDate("");
  }

  function handlePageChange(page: number) {
    navigate({ search, quickFilter, propertyId, buildingId, unitId, dueDate, page });
  }

  function openEdit(task: HousekeepingTaskListItem) {
    setFieldErrors({});
    setEditing(task);
  }

  function openCreate() {
    setFieldErrors({});
    setCreating(true);
  }

  function handleView(task: HousekeepingTaskListItem) {
    router.push(`/housekeeping/${task.id}`);
  }

  function handleCreateSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createHousekeepingTaskAction(formData);
      if (result.status === "success") {
        setFieldErrors({});
        setCreating(false);
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
      }
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
    });
  }

  function handleEditSubmit(formData: FormData) {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateHousekeepingTaskAction(editing.id, formData);
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

  function handleAssignSubmit(formData: FormData) {
    if (!assigning) return;
    startTransition(async () => {
      const result = await assignHousekeepingTaskAction(assigning.id, formData);
      if (result.status === "success") {
        setFieldErrors({});
        setAssigning(null);
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
      }
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
    });
  }

  function handleStart(task: HousekeepingTaskListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "update", task: { ...task, status: "in_progress" } });
      const result = await startHousekeepingTaskAction(task.id);
      if (result.status === "success") router.refresh();
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
    });
  }

  function handleComplete(task: HousekeepingTaskListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "update", task: { ...task, status: "completed" } });
      const formData = new FormData();
      const result = await completeHousekeepingTaskAction(task.id, formData);
      if (result.status === "success") router.refresh();
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
    });
  }

  function handleCancel(task: HousekeepingTaskListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "update", task: { ...task, status: "cancelled" } });
      const result = await cancelHousekeepingTaskAction(task.id);
      if (result.status === "success") router.refresh();
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
    });
  }

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <HousekeepingHeader canCreate={canManage} onCreate={openCreate} />
        </RevealItem>
        {metrics ? (
          <RevealItem>
            <HousekeepingStats metrics={metrics} />
          </RevealItem>
        ) : null}
        <RevealItem>
          <HousekeepingFiltersBar
            search={search}
            quickFilter={quickFilter}
            propertyId={propertyId}
            buildingId={buildingId}
            unitId={unitId}
            dueDate={dueDate}
            propertyOptions={propertyOptions}
            buildingOptions={buildingOptions}
            unitOptions={unitOptions}
            onSearch={setSearch}
            onQuickFilter={setQuickFilter}
            onProperty={setPropertyId}
            onBuilding={setBuildingId}
            onUnit={setUnitId}
            onDueDate={setDueDate}
          />
        </RevealItem>
        <RevealItem>
          <HousekeepingTable
            tasks={tasks}
            total={total}
            page={filters.page}
            pageSize={filters.pageSize}
            loading={false}
            filtersActive={filtersActive}
            pending={isPending}
            role={role}
            onView={handleView}
            onEdit={openEdit}
            onAssign={setAssigning}
            onStart={handleStart}
            onComplete={handleComplete}
            onCancel={handleCancel}
            onClearFilters={clearFilters}
            onPageChange={handlePageChange}
          />
        </RevealItem>
      </Reveal>

      <HousekeepingFormDrawer
        key={editing?.id ?? "none"}
        open={editing !== null}
        task={editing}
        eligibleUnitOptions={eligibleUnitOptions}
        teamMemberOptions={teamMemberOptions}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={() => setEditing(null)}
        onSubmit={handleEditSubmit}
      />

      <HousekeepingFormDrawer
        key={creating ? "creating" : "not-creating"}
        open={creating}
        task={null}
        eligibleUnitOptions={eligibleUnitOptions}
        teamMemberOptions={teamMemberOptions}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={() => setCreating(false)}
        onSubmit={handleCreateSubmit}
      />

      <HousekeepingAssignDrawer
        key={assigning?.id ?? "none"}
        open={assigning !== null}
        task={assigning}
        teamMemberOptions={teamMemberOptions}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={() => setAssigning(null)}
        onSubmit={handleAssignSubmit}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
