import { SectionCard } from "../home/section-card";
import { StatusPill } from "./status-pill";
import {
  avatarColor,
  formatDate,
  formatMoney,
  initials,
  paymentRef,
  statusLabel,
} from "./payment-format";
import type { PaymentListItem } from "../../../src/server/validators/payment";

interface RecentTransactionsProps {
  payments: PaymentListItem[];
}

export function RecentTransactions({ payments }: RecentTransactionsProps) {
  const recent = payments.slice(0, 5);

  return (
    <SectionCard
      id="recent-transactions"
      title="Recent transactions"
      bodyClassName="p-2"
    >
      {recent.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted">
          No transactions yet.
        </p>
      ) : (
        <ul>
          {recent.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-canvas"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{
                  backgroundColor: avatarColor(payment.customerId ?? payment.id),
                }}
              >
                {initials(payment.customerName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {payment.customerName}
                </p>
                <p className="truncate text-xs text-muted">
                  {paymentRef(payment.id)} ·{" "}
                  {formatDate(payment.paidAt ?? payment.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-medium tabular-nums text-white">
                  {formatMoney(payment.amountCents, payment.currency)}
                </span>
                <StatusPill status={statusLabel(payment.status)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
