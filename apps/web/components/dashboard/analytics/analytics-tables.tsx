import type { ReactNode } from "react";
import { SectionCard } from "../home/section-card";
import { Badge, type BadgeTone } from "../ui/badge";
import {
  formatDate,
  formatMoney,
  methodLabel,
  titleize,
} from "./analytics-format";
import type {
  RecentBookingRow,
  RecentPaymentRow,
  TopCustomerRow,
  TopServiceRow,
} from "./types";

const TH = "px-5 py-2.5 font-medium";

const BOOKING_TONES: Record<string, BadgeTone> = {
  confirmed: "success",
  pending: "warning",
  completed: "info",
  cancelled: "danger",
};

const PAYMENT_TONES: Record<string, BadgeTone> = {
  paid: "success",
  pending: "warning",
  failed: "danger",
  refunded: "neutral",
};

function TableCard({
  id,
  title,
  headers,
  empty,
  children,
}: {
  id: string;
  title: string;
  headers: { label: string; className?: string }[];
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <SectionCard id={id} title={title} bodyClassName="p-0">
      {empty ? (
        <p className="px-5 py-12 text-center text-sm text-muted">
          No data for this range.
        </p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-y border-hairline text-left text-xs text-muted">
              {headers.map((h) => (
                <th
                  key={h.label}
                  scope="col"
                  className={`${TH} ${h.className ?? ""}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </SectionCard>
  );
}

const ROW = "border-b border-hairline last:border-0";
const CELL = "px-5 py-3";

export function RecentBookingsTable({ rows }: { rows: RecentBookingRow[] }) {
  return (
    <TableCard
      id="recent-bookings"
      title="Recent bookings"
      empty={rows.length === 0}
      headers={[
        { label: "Customer" },
        { label: "Service", className: "hidden sm:table-cell" },
        { label: "Date", className: "hidden md:table-cell" },
        { label: "Status" },
        { label: "Amount", className: "text-right" },
      ]}
    >
      {rows.map((r) => (
        <tr key={r.id} className={ROW}>
          <td className={`${CELL} font-medium text-white`}>{r.customerName}</td>
          <td className={`${CELL} hidden text-muted sm:table-cell`}>
            {r.serviceName}
          </td>
          <td
            className={`${CELL} hidden whitespace-nowrap text-muted md:table-cell`}
          >
            {formatDate(r.startsAt)}
          </td>
          <td className={CELL}>
            <Badge tone={BOOKING_TONES[r.status] ?? "neutral"}>
              {titleize(r.status)}
            </Badge>
          </td>
          <td
            className={`${CELL} text-right font-medium tabular-nums text-white`}
          >
            {formatMoney(r.amountCents)}
          </td>
        </tr>
      ))}
    </TableCard>
  );
}

export function RecentPaymentsTable({ rows }: { rows: RecentPaymentRow[] }) {
  return (
    <TableCard
      id="recent-payments"
      title="Recent payments"
      empty={rows.length === 0}
      headers={[
        { label: "Customer" },
        { label: "Method", className: "hidden lg:table-cell" },
        { label: "Status" },
        { label: "Amount", className: "text-right" },
        { label: "Paid at", className: "hidden md:table-cell" },
      ]}
    >
      {rows.map((r) => (
        <tr key={r.id} className={ROW}>
          <td className={`${CELL} font-medium text-white`}>{r.customerName}</td>
          <td className={`${CELL} hidden text-muted lg:table-cell`}>
            {methodLabel(r.method)}
          </td>
          <td className={CELL}>
            <Badge tone={PAYMENT_TONES[r.status] ?? "neutral"}>
              {titleize(r.status)}
            </Badge>
          </td>
          <td
            className={`${CELL} text-right font-medium tabular-nums text-white`}
          >
            {formatMoney(r.amountCents, r.currency)}
          </td>
          <td
            className={`${CELL} hidden whitespace-nowrap text-muted md:table-cell`}
          >
            {r.paidAt ? formatDate(r.paidAt) : "—"}
          </td>
        </tr>
      ))}
    </TableCard>
  );
}

export function TopCustomersTable({ rows }: { rows: TopCustomerRow[] }) {
  return (
    <TableCard
      id="top-customers"
      title="Top customers"
      empty={rows.length === 0}
      headers={[
        { label: "Customer" },
        { label: "Total spent", className: "text-right" },
        { label: "Bookings", className: "text-right" },
      ]}
    >
      {rows.map((r) => (
        <tr key={r.id} className={ROW}>
          <td className={`${CELL} font-medium text-white`}>{r.name}</td>
          <td
            className={`${CELL} text-right font-medium tabular-nums text-white`}
          >
            {formatMoney(r.totalSpentCents)}
          </td>
          <td className={`${CELL} text-right tabular-nums text-muted`}>
            {r.bookings}
          </td>
        </tr>
      ))}
    </TableCard>
  );
}

export function TopServicesTable({ rows }: { rows: TopServiceRow[] }) {
  return (
    <TableCard
      id="top-services"
      title="Top services"
      empty={rows.length === 0}
      headers={[
        { label: "Service" },
        { label: "Bookings", className: "text-right" },
        { label: "Revenue", className: "text-right" },
      ]}
    >
      {rows.map((r) => (
        <tr key={r.id} className={ROW}>
          <td className={`${CELL} font-medium text-white`}>{r.name}</td>
          <td className={`${CELL} text-right tabular-nums text-muted`}>
            {r.bookings}
          </td>
          <td
            className={`${CELL} text-right font-medium tabular-nums text-white`}
          >
            {formatMoney(r.revenueCents)}
          </td>
        </tr>
      ))}
    </TableCard>
  );
}
