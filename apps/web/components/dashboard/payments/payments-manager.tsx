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
import { CheckIcon, PaymentsIcon } from "../../landing/icons";
import { ClockIcon } from "../home/icons";
import { RefundIcon } from "./icons";
import type { StatItem } from "../ui/stat-grid";
import {
  ProfileToast,
  type ToastState,
} from "../business-profile/profile-toast";
import { PaymentsFiltersBar } from "./payments-filters";
import { PaymentsHeader } from "./payments-header";
import { PaymentsStats } from "./payments-stats";
import { PaymentsTable } from "./payments-table";
import { PaymentDrawer } from "./payment-drawer";
import { PaymentFormDrawer } from "./payment-form-drawer";
import { RecentTransactions } from "./recent-transactions";
import { RevenueSummary } from "./revenue-summary";
import { formatMoney } from "./payment-format";
import {
  createPaymentAction,
  deletePaymentAction,
  updatePaymentAction,
} from "../../../src/server/actions/payment";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  PaymentBookingOption,
  PaymentFilterMethod,
  PaymentFilters,
  PaymentFilterStatus,
  PaymentListItem,
  PaymentMethodValue,
  PaymentStats,
  PaymentStatusValue,
} from "../../../src/server/validators/payment";

type OptimisticAction =
  | { type: "create"; payment: PaymentListItem }
  | { type: "update"; payment: PaymentListItem }
  | { type: "delete"; id: string };

interface PaymentsManagerProps {
  initialPayments: PaymentListItem[];
  stats: PaymentStats;
  filters: PaymentFilters;
  bookingOptions: PaymentBookingOption[];
  defaultCurrency: string;
}

interface FormState {
  open: boolean;
  mode: "create" | "edit";
  payment: PaymentListItem | null;
}

export function PaymentsManager({
  initialPayments,
  stats,
  filters,
  bookingOptions,
  defaultCurrency,
}: PaymentsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [payments, applyOptimistic] = useOptimistic(
    initialPayments,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "create":
          return [action.payment, ...state];
        case "update":
          return state.map((p) =>
            p.id === action.payment.id ? action.payment : p,
          );
        case "delete":
          return state.filter((p) => p.id !== action.id);
      }
    },
  );

  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState<PaymentFilterStatus>(filters.status);
  const [method, setMethod] = useState<PaymentFilterMethod>(filters.method);
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<PaymentListItem | null>(null);
  const [form, setForm] = useState<FormState>({
    open: false,
    mode: "create",
    payment: null,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const bookingById = useMemo(
    () => new Map(bookingOptions.map((b) => [b.id, b])),
    [bookingOptions],
  );

  const navigate = useCallback(
    (
      nextSearch: string,
      nextStatus: PaymentFilterStatus,
      nextMethod: PaymentFilterMethod,
    ) => {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("q", nextSearch.trim());
      if (nextStatus !== "all") params.set("status", nextStatus);
      if (nextMethod !== "all") params.set("method", nextMethod);
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
      () => navigate(search, status, method),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search, status, method, navigate]);

  const filtersActive =
    search.trim() !== "" || status !== "all" || method !== "all";

  const statItems: StatItem[] = [
    {
      id: "revenue",
      label: "Total revenue",
      value: formatMoney(stats.totalRevenueCents),
      icon: PaymentsIcon,
    },
    { id: "paid", label: "Paid", value: String(stats.paidCount), icon: CheckIcon },
    {
      id: "pending",
      label: "Pending",
      value: String(stats.pendingCount),
      icon: ClockIcon,
    },
    {
      id: "refunded",
      label: "Refunded",
      value: String(stats.refundedCount),
      icon: RefundIcon,
    },
  ];

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setMethod("all");
  }

  function openCreate() {
    setFieldErrors({});
    setForm({ open: true, mode: "create", payment: null });
  }

  function openEdit(payment: PaymentListItem) {
    setSelected(null);
    setFieldErrors({});
    setForm({ open: true, mode: "edit", payment });
  }

  function closeForm() {
    setForm((prev) => ({ ...prev, open: false }));
  }

  function handleDelete(payment: PaymentListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: payment.id });
      const result = await deletePaymentAction(payment.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleSubmit(formData: FormData) {
    const isEdit = form.mode === "edit" && form.payment !== null;
    const bookingId = String(formData.get("bookingId") ?? "");
    const booking = bookingById.get(bookingId);

    const optimisticPayment: PaymentListItem = {
      id: isEdit ? form.payment!.id : `optimistic-${Date.now()}`,
      bookingId,
      customerId: booking?.customerId ?? form.payment?.customerId ?? null,
      customerName: booking?.customerName ?? form.payment?.customerName ?? "—",
      serviceName: booking?.serviceName ?? form.payment?.serviceName ?? null,
      amountCents: Math.round(Number(formData.get("amount") ?? 0) * 100),
      currency: String(formData.get("currency") ?? defaultCurrency),
      method: String(formData.get("method") ?? "card") as PaymentMethodValue,
      status: String(formData.get("status") ?? "paid") as PaymentStatusValue,
      paidAt: form.payment?.paidAt ?? null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      createdAt: isEdit ? form.payment!.createdAt : new Date(),
    };

    startTransition(async () => {
      applyOptimistic(
        isEdit
          ? { type: "update", payment: optimisticPayment }
          : { type: "create", payment: optimisticPayment },
      );

      const result = isEdit
        ? await updatePaymentAction(form.payment!.id, formData)
        : await createPaymentAction(formData);

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
          <PaymentsHeader onAdd={openCreate} />
        </RevealItem>
        <RevealItem>
          <PaymentsStats stats={statItems} />
        </RevealItem>
        <RevealItem>
          <PaymentsFiltersBar
            search={search}
            status={status}
            method={method}
            onSearch={setSearch}
            onStatus={setStatus}
            onMethod={setMethod}
          />
        </RevealItem>
        <RevealItem>
          <PaymentsTable
            payments={payments}
            filtersActive={filtersActive}
            pending={isPending}
            onView={setSelected}
            onEdit={openEdit}
            onDelete={handleDelete}
            onClearFilters={clearFilters}
            onAdd={openCreate}
          />
        </RevealItem>
        <RevealItem>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RevenueSummary stats={stats} />
            <RecentTransactions payments={payments} />
          </div>
        </RevealItem>
      </Reveal>

      <PaymentDrawer
        payment={selected}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
      />

      <PaymentFormDrawer
        key={`${form.mode}-${form.payment?.id ?? "new"}`}
        open={form.open}
        mode={form.mode}
        payment={form.payment}
        bookingOptions={bookingOptions}
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
