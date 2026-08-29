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
import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { Reveal } from "../../landing/reveal";
import { PlusIcon, SearchIcon } from "../icons";
import { RowActionsMenu } from "../ui/row-actions";
import { TableEmptyState } from "../ui/table-states";
import { FieldInput } from "./field-input";
import { FieldSelect } from "./field-select";
import { ProfileSection } from "./profile-section";
import { ProfileToast, type ToastState } from "./profile-toast";
import { ServiceFormDrawer } from "./service-form-drawer";
import { StatusBadge } from "./status-badge";
import { formatDuration, formatPrice, statusLabel } from "./service-format";
import {
  createServiceAction,
  deleteServiceAction,
  updateServiceAction,
} from "../../../src/server/actions/service";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  ServiceFilters,
  ServiceFilterStatus,
  ServiceListItem,
  ServiceStatus,
} from "../../../src/server/validators/service";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "inactive", label: "Inactive" },
];

type OptimisticAction =
  | { type: "create"; service: ServiceListItem }
  | { type: "update"; service: ServiceListItem }
  | { type: "delete"; id: string };

interface ServicesManagerProps {
  initialServices: ServiceListItem[];
  filters: ServiceFilters;
  canManage: boolean;
}

interface DrawerState {
  open: boolean;
  mode: "create" | "edit";
  service: ServiceListItem | null;
}

export function ServicesManager({
  initialServices,
  filters,
  canManage,
}: ServicesManagerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [services, applyOptimistic] = useOptimistic(
    initialServices,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "create":
          return [action.service, ...state];
        case "update":
          return state.map((s) =>
            s.id === action.service.id ? action.service : s,
          );
        case "delete":
          return state.filter((s) => s.id !== action.id);
      }
    },
  );

  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState<ServiceFilterStatus>(filters.status);
  const [isPending, startTransition] = useTransition();

  const [drawer, setDrawer] = useState<DrawerState>({
    open: false,
    mode: "create",
    service: null,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  // Reflect the search/status filters into the URL so the server re-queries.
  const navigate = useCallback(
    (nextSearch: string, nextStatus: ServiceFilterStatus) => {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("q", nextSearch.trim());
      if (nextStatus !== "all") params.set("status", nextStatus);
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
    const timer = window.setTimeout(() => navigate(search, status), 300);
    return () => window.clearTimeout(timer);
  }, [search, status, navigate]);

  const filtersActive = search.trim() !== "" || status !== "all";

  function clearFilters() {
    setSearch("");
    setStatus("all");
  }

  function openCreate() {
    setFieldErrors({});
    setDrawer({ open: true, mode: "create", service: null });
  }

  function openEdit(service: ServiceListItem) {
    setFieldErrors({});
    setDrawer({ open: true, mode: "edit", service });
  }

  function closeDrawer() {
    setDrawer((prev) => ({ ...prev, open: false }));
  }

  function handleDelete(service: ServiceListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: service.id });
      const result = await deleteServiceAction(service.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleSubmit(formData: FormData) {
    const isEdit = drawer.mode === "edit" && drawer.service !== null;
    const optimisticService: ServiceListItem = {
      id: isEdit ? drawer.service!.id : `optimistic-${Date.now()}`,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "").trim() || null,
      durationMinutes: Number(formData.get("durationMinutes") ?? 0),
      priceCents: Math.round(Number(formData.get("price") ?? 0) * 100),
      status: String(formData.get("status") ?? "active") as ServiceStatus,
    };

    startTransition(async () => {
      applyOptimistic(
        isEdit
          ? { type: "update", service: optimisticService }
          : { type: "create", service: optimisticService },
      );

      const result = isEdit
        ? await updateServiceAction(drawer.service!.id, formData)
        : await createServiceAction(formData);

      if (result.status === "success") {
        setFieldErrors({});
        setDrawer((prev) => ({ ...prev, open: false }));
        setToast({ tone: "success", message: result.message });
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setToast({ tone: "error", message: result.message });
      }
    });
  }

  return (
    <Reveal as="div">
      <ProfileSection
        id="services"
        title="Services"
        description="The bookable services you offer, with duration and price."
        flush
      >
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid w-full grid-cols-1 gap-3 sm:max-w-md sm:grid-cols-2">
            <FieldInput
              label="Search"
              type="search"
              placeholder="Service name…"
              leftIcon={<SearchIcon className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <FieldSelect
              label="Status"
              options={STATUS_FILTER_OPTIONS}
              value={status}
              onChange={(e) => setStatus(e.target.value as ServiceFilterStatus)}
            />
          </div>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              className={CTA_SECONDARY}
              leftIcon={<PlusIcon className="h-4 w-4" />}
              onClick={openCreate}
            >
              Add service
            </Button>
          ) : null}
        </div>

        {services.length === 0 ? (
          filtersActive ? (
            <TableEmptyState
              icon={SearchIcon}
              title="No matching services"
              description="Try a different search term or status filter."
              onClear={clearFilters}
            />
          ) : (
            <div className="px-5 py-14 text-center">
              <p className="text-sm font-medium text-white">No services yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                Add your first bookable service to get started.
              </p>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  className={`${CTA_SECONDARY} mt-4`}
                  leftIcon={<PlusIcon className="h-4 w-4" />}
                  onClick={openCreate}
                >
                  Add service
                </Button>
              ) : null}
            </div>
          )
        ) : (
          <div
            aria-busy={isPending}
            className={`transition-opacity ${isPending ? "opacity-60" : ""}`}
          >
            <table className="w-full text-sm">
              <caption className="sr-only">Services offered</caption>
              <thead>
                <tr className="border-y border-hairline text-left text-xs text-muted">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Service name
                  </th>
                  <th
                    scope="col"
                    className="hidden px-5 py-2.5 font-medium sm:table-cell"
                  >
                    Duration
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Price
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr
                    key={service.id}
                    className="border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
                  >
                    <td className="px-5 py-3 font-medium text-white">
                      {service.name}
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3 text-muted sm:table-cell">
                      {formatDuration(service.durationMinutes)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-white">
                      {formatPrice(service.priceCents)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={statusLabel(service.status)} />
                    </td>
                    <td className="px-2 py-3 text-right">
                      {canManage ? (
                        <RowActionsMenu
                          label={`Actions for ${service.name}`}
                          actions={[
                            {
                              label: "Edit",
                              onSelect: () => openEdit(service),
                            },
                            {
                              label: "Delete",
                              danger: true,
                              onSelect: () => handleDelete(service),
                            },
                          ]}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ProfileSection>

      {canManage ? (
        <ServiceFormDrawer
          key={`${drawer.mode}-${drawer.service?.id ?? "new"}`}
          open={drawer.open}
          mode={drawer.mode}
          service={drawer.service}
          pending={isPending}
          fieldErrors={fieldErrors}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
        />
      ) : null}

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </Reveal>
  );
}
