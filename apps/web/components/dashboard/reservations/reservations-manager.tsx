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
import {
  ProfileToast,
  type ToastState,
} from "../business-profile/profile-toast";
import { ReservationFiltersBar } from "./reservation-filters";
import { ReservationHeader } from "./reservation-header";
import { ReservationStats } from "./reservation-stats";
import { ReservationDrawer } from "./reservation-drawer";
import { ReservationFormDrawer } from "./reservation-form-drawer";
import { ReservationTable } from "./reservation-table";
import {
  deleteReservationAction,
  updateReservationAction,
  updateReservationStatusAction,
} from "../../../src/server/actions/reservation";
import { createInvoiceForReservationAction } from "../../../src/server/actions/invoice";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  ReservationFilterStatus,
  ReservationFilters,
  ReservationListItem,
  ReservationMetrics,
  ReservationPersonOption,
  ReservationStatusValue,
} from "../../../src/server/validators/reservation";
import type { RentalUnitOption } from "../../../src/server/validators/rental-unit";
import { hasCapability } from "../../../src/server/auth/capabilities";

type OptimisticAction =
  | { type: "update"; reservation: ReservationListItem }
  | { type: "delete"; id: string };

interface ReservationsManagerProps {
  initialReservations: ReservationListItem[];
  metrics: ReservationMetrics | null;
  filters: ReservationFilters;
  unitOptions: RentalUnitOption[];
  customerOptions: ReservationPersonOption[];
  staffOptions: ReservationPersonOption[];
  defaultCurrency: string;
  role: string;
}

export function ReservationsManager({
  initialReservations,
  metrics,
  filters,
  unitOptions,
  customerOptions,
  staffOptions,
  defaultCurrency,
  role,
}: ReservationsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const canEdit = hasCapability({ role }, "reservations.assign");
  // Unit CRUD now lives in Property Management (manager-or-owner there too);
  // this only gates whether the "Manage units" shortcut link is shown.
  const canManageUnits = hasCapability({ role }, "rental_units.manage");

  const [reservations, applyOptimistic] = useOptimistic(
    initialReservations,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "update":
          return state.map((r) =>
            r.id === action.reservation.id ? action.reservation : r,
          );
        case "delete":
          return state.filter((r) => r.id !== action.id);
      }
    },
  );

  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState<ReservationFilterStatus>(filters.status);
  const [unitId, setUnitId] = useState(filters.unitId);
  const [staffId, setStaffId] = useState(filters.staffId);
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<ReservationListItem | null>(null);
  const [editing, setEditing] = useState<ReservationListItem | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const navigate = useCallback(
    (
      nextSearch: string,
      nextStatus: ReservationFilterStatus,
      nextUnit: string,
      nextStaff: string,
    ) => {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("q", nextSearch.trim());
      if (nextStatus !== "all") params.set("status", nextStatus);
      if (nextUnit !== "all") params.set("unit", nextUnit);
      if (nextStaff !== "all") params.set("staff", nextStaff);
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
      () => navigate(search, status, unitId, staffId),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search, status, unitId, staffId, navigate]);

  const filtersActive =
    search.trim() !== "" ||
    status !== "all" ||
    unitId !== "all" ||
    staffId !== "all";

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setUnitId("all");
    setStaffId("all");
  }

  function openEdit(reservation: ReservationListItem) {
    setSelected(null);
    setFieldErrors({});
    setEditing(reservation);
  }

  function closeEdit() {
    setEditing(null);
  }

  function handleDelete(reservation: ReservationListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: reservation.id });
      const result = await deleteReservationAction(reservation.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleStatusChange(
    reservation: ReservationListItem,
    next: ReservationStatusValue,
  ) {
    startTransition(async () => {
      applyOptimistic({
        type: "update",
        reservation: { ...reservation, status: next },
      });
      const result = await updateReservationStatusAction(reservation.id, next);
      setSelected(null);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleCreateInvoice(reservation: ReservationListItem) {
    startTransition(async () => {
      const result = await createInvoiceForReservationAction(reservation.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleEditSubmit(formData: FormData) {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateReservationAction(editing.id, formData);
      if (result.status === "success") {
        setFieldErrors({});
        setEditing(null);
        setToast({ tone: "success", message: result.message });
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setToast({ tone: "error", message: result.message });
      }
    });
  }

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <ReservationHeader canManageUnits={canManageUnits} />
        </RevealItem>
        {metrics ? (
          <RevealItem>
            <ReservationStats metrics={metrics} />
          </RevealItem>
        ) : null}
        <RevealItem>
          <ReservationFiltersBar
            search={search}
            status={status}
            unitId={unitId}
            staffId={staffId}
            unitOptions={unitOptions}
            staffOptions={staffOptions}
            onSearch={setSearch}
            onStatus={setStatus}
            onUnit={setUnitId}
            onStaff={setStaffId}
          />
        </RevealItem>
        <RevealItem>
          <ReservationTable
            reservations={reservations}
            loading={false}
            filtersActive={filtersActive}
            pending={isPending}
            canEdit={canEdit}
            onView={setSelected}
            onEdit={openEdit}
            onDelete={handleDelete}
            onClearFilters={clearFilters}
          />
        </RevealItem>
      </Reveal>

      <ReservationDrawer
        reservation={selected}
        role={role}
        canEdit={canEdit}
        pending={isPending}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onStatusChange={handleStatusChange}
        onCreateInvoice={handleCreateInvoice}
      />

      <ReservationFormDrawer
        key={editing?.id ?? "none"}
        open={editing !== null}
        reservation={editing}
        unitOptions={unitOptions}
        customerOptions={customerOptions}
        staffOptions={staffOptions}
        defaultCurrency={defaultCurrency}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={closeEdit}
        onSubmit={handleEditSubmit}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
