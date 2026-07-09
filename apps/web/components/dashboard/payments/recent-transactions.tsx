import { SectionCard } from "../home/section-card";
import { PAYMENTS } from "./mock-data";
import { StatusPill } from "./status-pill";

const RECENT = PAYMENTS.slice(0, 5);

export function RecentTransactions() {
  return (
    <SectionCard id="recent-transactions" title="Recent transactions" bodyClassName="p-2">
      <ul>
        {RECENT.map((payment) => (
          <li
            key={payment.id}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-canvas"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: payment.customer.color }}
            >
              {payment.customer.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {payment.customer.name}
              </p>
              <p className="truncate text-xs text-muted">
                {payment.invoice} · {payment.date}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-medium tabular-nums text-white">
                {payment.amount}
              </span>
              <StatusPill status={payment.status} />
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
