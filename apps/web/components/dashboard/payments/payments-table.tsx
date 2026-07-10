"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { PlusIcon } from "../icons";
import { TableEmptyState } from "../ui/table-states";
import { PaymentActions } from "./payment-actions";
import { ReceiptIcon } from "./icons";
import { StatusPill } from "./status-pill";
import {
  avatarColor,
  formatDate,
  formatMoney,
  initials,
  methodLabel,
  paymentRef,
  statusLabel,
} from "./payment-format";
import type { PaymentListItem } from "../../../src/server/validators/payment";

interface PaymentsTableProps {
  payments: PaymentListItem[];
  filtersActive: boolean;
  pending: boolean;
  onView: (payment: PaymentListItem) => void;
  onEdit: (payment: PaymentListItem) => void;
  onDelete: (payment: PaymentListItem) => void;
  onClearFilters: () => void;
  onAdd: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function PaymentRow({
  payment,
  onView,
  onEdit,
  onDelete,
}: {
  payment: PaymentListItem;
  onView: (payment: PaymentListItem) => void;
  onEdit: (payment: PaymentListItem) => void;
  onDelete: (payment: PaymentListItem) => void;
}) {
  return (
    <tr
      onClick={() => onView(payment)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onView(payment);
          }}
          className="text-left text-sm font-medium tabular-nums text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {paymentRef(payment.id)}
        </button>
      </td>
      <td className="hidden px-5 py-3 sm:table-cell">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: avatarColor(payment.customerId ?? payment.id) }}
          >
            {initials(payment.customerName)}
          </span>
          <span className="truncate text-sm text-white">
            {payment.customerName}
          </span>
        </div>
      </td>
      <td className="px-5 py-3 text-sm font-medium tabular-nums text-white">
        {formatMoney(payment.amountCents, payment.currency)}
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-sm text-muted lg:table-cell">
        {methodLabel(payment.method)}
      </td>
      <td className="px-5 py-3">
        <StatusPill status={statusLabel(payment.status)} />
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-sm text-muted md:table-cell">
        {formatDate(payment.paidAt ?? payment.createdAt)}
      </td>
      <td
        className="px-3 py-3 text-right"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <PaymentActions
            onView={() => onView(payment)}
            onEdit={() => onEdit(payment)}
            onDelete={() => onDelete(payment)}
          />
        </div>
      </td>
    </tr>
  );
}

export function PaymentsTable({
  payments,
  filtersActive,
  pending,
  onView,
  onEdit,
  onDelete,
  onClearFilters,
  onAdd,
}: PaymentsTableProps) {
  return (
    <SectionCard
      id="payments"
      title="All payments"
      bodyClassName="p-0"
      action={
        <span className="text-xs text-muted">
          {payments.length} {payments.length === 1 ? "result" : "results"}
        </span>
      }
    >
      {payments.length === 0 ? (
        filtersActive ? (
          <TableEmptyState
            icon={ReceiptIcon}
            title="No payments found"
            description="No payments match your filters. Try adjusting or clearing them."
            onClear={onClearFilters}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
              <ReceiptIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-white">
              No payments yet
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Record your first payment against a booking to start tracking
              revenue.
            </p>
            <Button
              type="button"
              size="sm"
              className={`${CTA_SECONDARY} mt-4`}
              leftIcon={<PlusIcon className="h-4 w-4" />}
              onClick={onAdd}
            >
              Record payment
            </Button>
          </div>
        )
      ) : (
        <div
          aria-busy={pending}
          className={`transition-opacity ${pending ? "opacity-60" : ""}`}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">Payments</caption>
            <thead>
              <tr className="border-y border-hairline text-left text-xs text-muted">
                <th scope="col" className={TH}>
                  Reference
                </th>
                <th scope="col" className={`hidden sm:table-cell ${TH}`}>
                  Customer
                </th>
                <th scope="col" className={TH}>
                  Amount
                </th>
                <th scope="col" className={`hidden lg:table-cell ${TH}`}>
                  Method
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={`hidden md:table-cell ${TH}`}>
                  Date
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
