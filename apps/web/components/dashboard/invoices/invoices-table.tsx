"use client";

import { SectionCard } from "../home/section-card";
import { InvoiceIcon } from "../icons";
import { TableEmptyState } from "../ui/table-states";
import { StatusPill } from "./status-pill";
import {
  avatarColor,
  formatDate,
  formatMoney,
  initials,
  statusLabel,
} from "./invoice-format";
import type { InvoiceRow } from "./types";

interface InvoicesTableProps {
  invoices: InvoiceRow[];
  filtersActive: boolean;
  pending: boolean;
  onView: (invoice: InvoiceRow) => void;
  onClearFilters: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function InvoiceRowItem({
  invoice,
  onView,
}: {
  invoice: InvoiceRow;
  onView: (invoice: InvoiceRow) => void;
}) {
  const customerName = invoice.customerName ?? invoice.customerNameSnapshot ?? "—";

  return (
    <tr
      onClick={() => onView(invoice)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onView(invoice);
          }}
          className="text-left text-sm font-medium tabular-nums text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {invoice.number}
        </button>
      </td>
      <td className="hidden px-5 py-3 sm:table-cell">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: avatarColor(invoice.customerId ?? invoice.id) }}
          >
            {initials(customerName)}
          </span>
          <span className="truncate text-sm text-white">{customerName}</span>
        </div>
      </td>
      <td className="px-5 py-3 text-sm font-medium tabular-nums text-white">
        {formatMoney(invoice.amountCents, invoice.currency)}
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-sm text-muted lg:table-cell">
        {formatMoney(invoice.outstandingCents, invoice.currency)}
      </td>
      <td className="px-5 py-3">
        <StatusPill status={statusLabel(invoice.status)} />
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-sm text-muted md:table-cell">
        {formatDate(invoice.issuedAt ?? invoice.createdAt)}
      </td>
    </tr>
  );
}

export function InvoicesTable({
  invoices,
  filtersActive,
  pending,
  onView,
  onClearFilters,
}: InvoicesTableProps) {
  return (
    <SectionCard
      id="invoices"
      title="All invoices"
      bodyClassName="p-0"
      action={
        <span className="text-xs text-muted">
          {invoices.length} {invoices.length === 1 ? "result" : "results"}
        </span>
      }
    >
      {invoices.length === 0 ? (
        filtersActive ? (
          <TableEmptyState
            icon={InvoiceIcon}
            title="No invoices found"
            description="No invoices match your filters. Try adjusting or clearing them."
            onClear={onClearFilters}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
              <InvoiceIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-white">No invoices yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Invoices billed against a reservation will appear here.
            </p>
          </div>
        )
      ) : (
        <div
          aria-busy={pending}
          className={`transition-opacity ${pending ? "opacity-60" : ""}`}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">Invoices</caption>
            <thead>
              <tr className="border-y border-hairline text-left text-xs text-muted">
                <th scope="col" className={TH}>
                  Number
                </th>
                <th scope="col" className={`hidden sm:table-cell ${TH}`}>
                  Customer
                </th>
                <th scope="col" className={TH}>
                  Amount
                </th>
                <th scope="col" className={`hidden lg:table-cell ${TH}`}>
                  Outstanding
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={`hidden md:table-cell ${TH}`}>
                  Issued
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <InvoiceRowItem key={invoice.id} invoice={invoice} onView={onView} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
