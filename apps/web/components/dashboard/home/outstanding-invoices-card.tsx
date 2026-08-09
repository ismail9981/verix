import Link from "next/link";
import { SectionCard } from "./section-card";
import { formatMoney } from "../invoices/invoice-format";
import type { OutstandingInvoicesSummary } from "../../../src/server/validators/dashboard-analytics";

/*
 * Outstanding invoices widget (Sprint 18) — a ranked list, reusing
 * `SectionCard` and the invoices feature's own `formatMoney`. Not date-range
 * scoped: an invoice is outstanding right now or it isn't, same as
 * `getOutstandingInvoicesSummary` (the function this data comes from) itself
 * — it takes no date range.
 */
export function OutstandingInvoicesCard({
  outstanding,
}: {
  outstanding: OutstandingInvoicesSummary | null;
}) {
  return (
    <SectionCard
      id="dashboard-outstanding"
      title="Outstanding invoices"
      action={
        <Link href="/invoices" className="text-xs font-medium text-accent hover:text-accent-strong">
          View all
        </Link>
      }
    >
      {!outstanding ? (
        <p className="py-12 text-center text-sm text-muted">
          You don&apos;t have permission to view outstanding balances.
        </p>
      ) : outstanding.topInvoices.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">No outstanding invoices.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-2xl font-bold tracking-tight text-white">
              {formatMoney(outstanding.totalCents, outstanding.currency)}
            </p>
            <p className="text-xs text-muted">Total outstanding, as of today</p>
          </div>
          <ul className="flex flex-col gap-1">
            {outstanding.topInvoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{invoice.number}</p>
                  <p className="truncate text-xs text-muted">{invoice.customerName ?? "—"}</p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-white">
                  {formatMoney(invoice.outstandingCents, invoice.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
