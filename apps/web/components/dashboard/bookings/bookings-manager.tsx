"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Reveal, RevealItem } from "../../landing/reveal";
import { CheckIcon } from "../../landing/icons";
import { CloseIcon } from "../icons";
import { CalendarIcon, ClockIcon } from "./icons";
import type { StatItem } from "../ui/stat-grid";
import {
  ProfileToast,
  type ToastState,
} from "../business-profile/profile-toast";
import { BookingFiltersBar } from "./booking-filters";
import { BookingHeader } from "./booking-header";
import { BookingStats } from "./booking-stats";
import { BookingDrawer } from "./booking-drawer";
import { BookingFormDrawer } from "./booking-form-drawer";
import { BookingTable } from "./booking-table";
import {
  createBookingAction,
  deleteBookingAction,
  updateBookingAction,
} from "../../../src/server/actions/booking";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  BookingFilters,
  BookingFilterStatus,
  BookingListItem,
  BookingOption,
  BookingStats as BookingStatsData,
  BookingStatusValue,
} from "../../../src/server/validators/booking";

type OptimisticAction =
  | { type: "create"; booking: BookingListItem }
  | { type: "update"; booking: BookingListItem }
  | { type: "delete"; id: string };

interface BookingsManagerProps {
  initialBookings: BookingListItem[];
  stats: BookingStatsData;
  filters: BookingFilters;
  customerOptions: BookingOption[];
  serviceOptions: BookingOption[];
  canManage: boolean;
}

interface FormState {
  open: boolean;
  mode: "create" | "edit";
  booking: BookingListItem | null;
}

export function BookingsManager({
  initialBookings,
  stats,
  filters,
  customerOptions,
  serviceOptions,
  canManage,
}: BookingsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [bookings, applyOptimistic] = useOptimistic(
    initialBookings,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "create":
          return [action.booking, ...state];
        case "update":
          return state.map((b) =>
            b.id === action.booking.id ? action.booking : b,
          );
        case "delete":
          return state.filter((b) => b.id !== action.id);
      }
    },
  );

  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState<BookingFilterStatus>(filters.status);
  const [service, setService] = useState(filters.service);
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<BookingListItem | null>(null);
  const [form, setForm] = useState<FormState>({
    open: false,
    mode: "create",
    booking: null,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const customerNames = useMemo(
    () => new Map(customerOptions.map((c) => [c.id, c.name])),
    [customerOptions],
  );
  const serviceNames = useMemo(
    () => new Map(serviceOptions.map((s) => [s.id, s.name])),
    [serviceOptions],
  );

  // Reflect filters into the URL so the server re-queries.
  const navigate = useCallback(
    (
      nextSearch: string,
      nextStatus: BookingFilterStatus,
      nextService: string,
    ) => {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("q", nextSearch.trim());
      if (nextStatus !== "all") params.set("status", nextStatus);
      if (nextService !== "all") params.set("service", nextService);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  // Debounce filter changes (skip the initial mount, which already matches URL).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = window.setTimeout(
      () => navigate(search, status, service),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search, status, service, navigate]);

  const filtersActive =
    search.trim() !== "" || status !== "all" || service !== "all";

  const statItems: StatItem[] = [
    {
      id: "total",
      label: "Total bookings",
      value: String(stats.total),
      icon: CalendarIcon,
    },
    {
      id: "upcoming",
      label: "Upcoming",
      value: String(stats.upcoming),
      icon: ClockIcon,
    },
    {
      id: "completed",
      label: "Completed",
      value: String(stats.completed),
      icon: CheckIcon,
    },
    {
      id: "cancelled",
      label: "Cancelled",
      value: String(stats.cancelled),
      icon: CloseIcon,
    },
  ];

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setService("all");
  }

  function openCreate() {
    setFieldErrors({});
    setForm({ open: true, mode: "create", booking: null });
  }

  function openEdit(booking: BookingListItem) {
    setSelected(null);
    setFieldErrors({});
    setForm({ open: true, mode: "edit", booking });
  }

  function closeForm() {
    setForm((prev) => ({ ...prev, open: false }));
  }

  function handleDelete(booking: BookingListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: booking.id });
      const result = await deleteBookingAction(booking.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleSubmit(formData: FormData) {
    const isEdit = form.mode === "edit" && form.booking !== null;
    const customerId = String(formData.get("customerId") ?? "");
    const serviceId = String(formData.get("serviceId") ?? "");
    const startsRaw = String(formData.get("startsAt") ?? "");
    const endsRaw = String(formData.get("endsAt") ?? "");

    const optimisticBooking: BookingListItem = {
      id: isEdit ? form.booking!.id : `optimistic-${Date.now()}`,
      customerId,
      customerName: customerNames.get(customerId) ?? "—",
      serviceId,
      serviceName: serviceNames.get(serviceId) ?? "—",
      status: String(
        formData.get("status") ?? "confirmed",
      ) as BookingStatusValue,
      startsAt: startsRaw ? new Date(startsRaw) : new Date(),
      endsAt: endsRaw ? new Date(endsRaw) : new Date(),
      notes: String(formData.get("notes") ?? "").trim() || null,
      createdAt: isEdit ? form.booking!.createdAt : new Date(),
    };

    startTransition(async () => {
      applyOptimistic(
        isEdit
          ? { type: "update", booking: optimisticBooking }
          : { type: "create", booking: optimisticBooking },
      );

      const result = isEdit
        ? await updateBookingAction(form.booking!.id, formData)
        : await createBookingAction(formData);

      if (result.status === "success") {
        setFieldErrors({});
        setForm((prev) => ({ ...prev, open: false }));
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
          <BookingHeader onAdd={openCreate} canManage={canManage} />
        </RevealItem>
        <RevealItem>
          <BookingStats stats={statItems} />
        </RevealItem>
        <RevealItem>
          <BookingFiltersBar
            search={search}
            status={status}
            service={service}
            serviceOptions={serviceOptions}
            onSearch={setSearch}
            onStatus={setStatus}
            onService={setService}
          />
        </RevealItem>
        <RevealItem>
          <BookingTable
            bookings={bookings}
            loading={false}
            filtersActive={filtersActive}
            pending={isPending}
            onView={setSelected}
            onEdit={openEdit}
            onDelete={handleDelete}
            onClearFilters={clearFilters}
            onAdd={openCreate}
            canManage={canManage}
          />
        </RevealItem>
      </Reveal>

      <BookingDrawer
        booking={selected}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        canManage={canManage}
      />

      <BookingFormDrawer
        key={`${form.mode}-${form.booking?.id ?? "new"}`}
        open={form.open}
        mode={form.mode}
        booking={form.booking}
        customerOptions={customerOptions}
        serviceOptions={serviceOptions}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
