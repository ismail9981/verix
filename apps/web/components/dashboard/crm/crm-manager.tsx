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
import { TeamIcon } from "../icons";
import { UserPlusIcon, TrendUpIcon } from "../home/icons";
import { StarIcon } from "./icons";
import type { StatItem } from "../ui/stat-grid";
import { ProfileToast, type ToastState } from "../business-profile/profile-toast";
import { CrmFiltersBar } from "./crm-filters";
import { CrmHeader } from "./crm-header";
import { CrmStats } from "./crm-stats";
import { CustomerDrawer } from "./customer-drawer";
import { CustomerFormDrawer } from "./customer-form-drawer";
import { CustomerTable } from "./customer-table";
import {
  createCustomerAction,
  deleteCustomerAction,
  updateCustomerAction,
} from "../../../src/server/actions/customer";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  CustomerFilters,
  CustomerFilterStatus,
  CustomerListItem,
  CustomerStats,
  CustomerStatusValue,
} from "../../../src/server/validators/customer";

type OptimisticAction =
  | { type: "create"; customer: CustomerListItem }
  | { type: "update"; customer: CustomerListItem }
  | { type: "delete"; id: string };

interface CrmManagerProps {
  initialCustomers: CustomerListItem[];
  stats: CustomerStats;
  filters: CustomerFilters;
}

interface FormState {
  open: boolean;
  mode: "create" | "edit";
  customer: CustomerListItem | null;
}

export function CrmManager({
  initialCustomers,
  stats,
  filters,
}: CrmManagerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [customers, applyOptimistic] = useOptimistic(
    initialCustomers,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "create":
          return [action.customer, ...state];
        case "update":
          return state.map((c) =>
            c.id === action.customer.id ? action.customer : c,
          );
        case "delete":
          return state.filter((c) => c.id !== action.id);
      }
    },
  );

  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState<CustomerFilterStatus>(filters.status);
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<CustomerListItem | null>(null);
  const [form, setForm] = useState<FormState>({
    open: false,
    mode: "create",
    customer: null,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  // Reflect filters into the URL so the server re-queries.
  const navigate = useCallback(
    (nextSearch: string, nextStatus: CustomerFilterStatus) => {
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

  const statItems: StatItem[] = [
    { id: "total", label: "Total customers", value: String(stats.total), icon: TeamIcon },
    { id: "active", label: "Active", value: String(stats.active), icon: TrendUpIcon },
    { id: "new", label: "New", value: String(stats.new), icon: UserPlusIcon },
    { id: "vip", label: "VIP", value: String(stats.vip), icon: StarIcon },
  ];

  function clearFilters() {
    setSearch("");
    setStatus("all");
  }

  function openCreate() {
    setFieldErrors({});
    setForm({ open: true, mode: "create", customer: null });
  }

  function openEdit(customer: CustomerListItem) {
    setSelected(null);
    setFieldErrors({});
    setForm({ open: true, mode: "edit", customer });
  }

  function closeForm() {
    setForm((prev) => ({ ...prev, open: false }));
  }

  function handleDelete(customer: CustomerListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: customer.id });
      const result = await deleteCustomerAction(customer.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleSubmit(formData: FormData) {
    const isEdit = form.mode === "edit" && form.customer !== null;
    const optimisticCustomer: CustomerListItem = {
      id: isEdit ? form.customer!.id : `optimistic-${Date.now()}`,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      status: String(formData.get("status") ?? "new") as CustomerStatusValue,
      totalSpentCents: isEdit ? form.customer!.totalSpentCents : 0,
      notes: String(formData.get("notes") ?? "").trim() || null,
      createdAt: isEdit ? form.customer!.createdAt : new Date(),
    };

    startTransition(async () => {
      applyOptimistic(
        isEdit
          ? { type: "update", customer: optimisticCustomer }
          : { type: "create", customer: optimisticCustomer },
      );

      const result = isEdit
        ? await updateCustomerAction(form.customer!.id, formData)
        : await createCustomerAction(formData);

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
          <CrmHeader onAdd={openCreate} />
        </RevealItem>
        <RevealItem>
          <CrmStats stats={statItems} />
        </RevealItem>
        <RevealItem>
          <CrmFiltersBar
            search={search}
            status={status}
            onSearch={setSearch}
            onStatus={setStatus}
          />
        </RevealItem>
        <RevealItem>
          <CustomerTable
            customers={customers}
            loading={false}
            filtersActive={filtersActive}
            pending={isPending}
            onView={setSelected}
            onEdit={openEdit}
            onDelete={handleDelete}
            onClearFilters={clearFilters}
            onAdd={openCreate}
          />
        </RevealItem>
      </Reveal>

      <CustomerDrawer
        customer={selected}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
      />

      <CustomerFormDrawer
        key={`${form.mode}-${form.customer?.id ?? "new"}`}
        open={form.open}
        mode={form.mode}
        customer={form.customer}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
