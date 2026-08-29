"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Reveal, RevealItem } from "../../landing/reveal";
import {
  ProfileToast,
  type ToastState,
} from "../business-profile/profile-toast";
import { InvoicesFiltersBar } from "./invoices-filters";
import { InvoicesHeader } from "./invoices-header";
import { InvoicesTable } from "./invoices-table";
import { InvoiceDrawer, type VoidFieldError } from "./invoice-drawer";
import { InvoiceRecordFormDrawer } from "./invoice-record-form-drawer";
import {
  recordPaymentAction,
  recordRefundAction,
  voidPaymentAction,
} from "../../../src/server/actions/invoice";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { InvoiceRow, InvoiceStatusFilter } from "./types";
import { hasCapability } from "../../../src/server/auth/capabilities";

/*
 * Sprint 17 Phase 2. Deliberately no `useOptimistic` and no local patching of
 * invoice/payment state — billing mutations affect server-derived financial
 * fields (payment history, net paid, outstanding, invoice status, refund
 * eligibility) that this component must never guess at. `selected`/
 * `formInvoice` are always re-derived from the latest `initialInvoices` prop;
 * the only way that prop ever changes is a fresh Server Component render
 * triggered by `router.refresh()` after a successful mutation. The server
 * remains the sole source of truth.
 */

interface InvoicesManagerProps {
  initialInvoices: InvoiceRow[];
  role: string;
}

interface FormState {
  mode: "payment" | "refund";
  invoiceId: string;
}

export function InvoicesManager({
  initialInvoices,
  role,
}: InvoicesManagerProps) {
  const router = useRouter();
  const canManage = hasCapability({ role }, "invoices.manage");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatusFilter>("all");
  const [isPending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [voidFieldError, setVoidFieldError] = useState<VoidFieldError | null>(
    null,
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const selected = selectedId
    ? (initialInvoices.find((invoice) => invoice.id === selectedId) ?? null)
    : null;
  const formInvoice = form
    ? (initialInvoices.find((invoice) => invoice.id === form.invoiceId) ?? null)
    : null;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return initialInvoices.filter((invoice) => {
      if (status !== "all" && invoice.status !== status) return false;
      if (!query) return true;
      const number = invoice.number.toLowerCase();
      const customer = (
        invoice.customerName ??
        invoice.customerNameSnapshot ??
        ""
      ).toLowerCase();
      return number.includes(query) || customer.includes(query);
    });
  }, [initialInvoices, search, status]);

  const filtersActive = search.trim() !== "" || status !== "all";

  function clearFilters() {
    setSearch("");
    setStatus("all");
  }

  function openView(invoice: InvoiceRow) {
    setSelectedId(invoice.id);
  }

  function closeView() {
    setSelectedId(null);
    setVoidFieldError(null);
  }

  // Mirrors the payments feature's `openEdit`: close the view drawer before
  // opening the form drawer so the two never stack.
  function openRecordPayment(invoice: InvoiceRow) {
    setSelectedId(null);
    setFieldErrors({});
    setForm({ mode: "payment", invoiceId: invoice.id });
  }

  function openRecordRefund(invoice: InvoiceRow) {
    setSelectedId(null);
    setFieldErrors({});
    setForm({ mode: "refund", invoiceId: invoice.id });
  }

  function closeForm() {
    setForm(null);
  }

  function handleFormSubmit(formData: FormData) {
    if (!form) return;
    const { mode, invoiceId } = form;

    startTransition(async () => {
      const result =
        mode === "payment"
          ? await recordPaymentAction(invoiceId, formData)
          : await recordRefundAction(invoiceId, formData);

      if (result.status === "success") {
        setForm(null);
        setSelectedId(null);
        setFieldErrors({});
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
      }
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleVoidPayment(
    invoice: InvoiceRow,
    paymentId: string,
    reason: string,
  ) {
    const formData = new FormData();
    formData.set("reason", reason);

    startTransition(async () => {
      const result = await voidPaymentAction(paymentId, formData);

      if (result.status === "success") {
        setSelectedId(null);
        setVoidFieldError(null);
        router.refresh();
      } else {
        const reasonError = result.fieldErrors?.reason?.[0];
        setVoidFieldError(
          reasonError ? { paymentId, message: reasonError } : null,
        );
      }
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <InvoicesHeader />
        </RevealItem>
        <RevealItem>
          <InvoicesFiltersBar
            search={search}
            status={status}
            onSearch={setSearch}
            onStatus={setStatus}
          />
        </RevealItem>
        <RevealItem>
          <InvoicesTable
            invoices={filtered}
            filtersActive={filtersActive}
            pending={isPending}
            onView={openView}
            onClearFilters={clearFilters}
          />
        </RevealItem>
      </Reveal>

      <InvoiceDrawer
        key={`view-${selected?.id ?? "none"}`}
        invoice={selected}
        canManage={canManage}
        pending={isPending}
        voidFieldError={voidFieldError}
        onClose={closeView}
        onRecordPayment={openRecordPayment}
        onRecordRefund={openRecordRefund}
        onVoidPayment={handleVoidPayment}
        onClearVoidFieldError={() => setVoidFieldError(null)}
      />

      <InvoiceRecordFormDrawer
        key={form ? `form-${form.mode}-${form.invoiceId}` : "form-none"}
        open={form !== null}
        mode={form?.mode ?? "payment"}
        invoice={formInvoice}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
