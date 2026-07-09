"use client";

import { SectionCard } from "../home/section-card";
import { TableEmptyState, TableSkeleton } from "../ui/table-states";
import { PaymentActions } from "./payment-actions";
import { ReceiptIcon } from "./icons";
import { StatusPill } from "./status-pill";
import type { Payment } from "./types";

interface PaymentsTableProps {
  payments: Payment[];
  loading: boolean;
  onSelect: (payment: Payment) => void;
  onClearFilters: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function PaymentRow({
  payment,
  onSelect,
}: {
  payment: Payment;
  onSelect: (payment: Payment) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(payment)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(payment);
          }}
          className="text-left text-sm font-medium tabular-nums text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {payment.invoice}
        </button>
      </td>
      <td className="hidden px-5 py-3 sm:table-cell">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: payment.customer.color }}
          >
            {payment.customer.initials}
          </span>
          <span className="truncate text-sm text-white">{payment.customer.name}</span>
        </div>
      </td>
      <td className="px-5 py-3 text-sm font-medium tabular-nums text-white">
        {payment.amount}
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-sm text-muted lg:table-cell">
        {payment.method}
        {payment.last4 !== "—" ? ` •••• ${payment.last4}` : ""}
      </td>
      <td className="px-5 py-3">
        <StatusPill status={payment.status} />
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-sm text-muted md:table-cell">
        {payment.date}
      </td>
      <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <PaymentActions onView={() => onSelect(payment)} />
        </div>
      </td>
    </tr>
  );
}

export function PaymentsTable({
  payments,
  loading,
  onSelect,
  onClearFilters,
}: PaymentsTableProps) {
  return (
    <SectionCard
      id="payments"
      title="All payments"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">{payments.length} results</span>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : payments.length === 0 ? (
        <TableEmptyState
          icon={ReceiptIcon}
          title="No payments found"
          description="No payments match your current filters. Try adjusting or clearing them."
          onClear={onClearFilters}
        />
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Payments</caption>
          <thead>
            <tr className="border-y border-hairline text-left text-xs text-muted">
              <th scope="col" className={TH}>Invoice</th>
              <th scope="col" className={`hidden sm:table-cell ${TH}`}>Customer</th>
              <th scope="col" className={TH}>Amount</th>
              <th scope="col" className={`hidden lg:table-cell ${TH}`}>Method</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={`hidden md:table-cell ${TH}`}>Date</th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
