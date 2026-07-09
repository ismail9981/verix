"use client";

import { SectionCard } from "../home/section-card";
import { CustomerActions } from "./customer-actions";
import { CustomerEmpty } from "./customer-empty";
import { CustomerSkeleton } from "./customer-skeleton";
import { StatusPill } from "./status-pill";
import type { Customer } from "./types";

interface CustomerTableProps {
  customers: Customer[];
  loading: boolean;
  onSelect: (customer: Customer) => void;
  onClearFilters: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function CustomerRow({
  customer,
  onSelect,
}: {
  customer: Customer;
  onSelect: (customer: Customer) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(customer)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: customer.color }}
          >
            {customer.initials}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(customer);
            }}
            className="truncate text-left text-sm font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {customer.name}
          </button>
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted xl:table-cell">
        {customer.phone}
      </td>
      <td className="hidden px-5 py-3 text-muted lg:table-cell">
        <span className="block max-w-[16rem] truncate">{customer.email}</span>
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">
        {customer.lastVisit}
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 font-medium text-white sm:table-cell">
        {customer.totalSpent}
      </td>
      <td className="px-5 py-3">
        <StatusPill status={customer.status} />
      </td>
      <td
        className="px-3 py-3 text-right"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <CustomerActions onView={() => onSelect(customer)} />
        </div>
      </td>
    </tr>
  );
}

export function CustomerTable({
  customers,
  loading,
  onSelect,
  onClearFilters,
}: CustomerTableProps) {
  return (
    <SectionCard
      id="customers"
      title="All customers"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">{customers.length} results</span>
        ) : null
      }
    >
      {loading ? (
        <CustomerSkeleton />
      ) : customers.length === 0 ? (
        <CustomerEmpty onClear={onClearFilters} />
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Customers</caption>
          <thead>
            <tr className="border-y border-hairline text-left text-xs text-muted">
              <th scope="col" className={TH}>Customer</th>
              <th scope="col" className={`hidden xl:table-cell ${TH}`}>Phone</th>
              <th scope="col" className={`hidden lg:table-cell ${TH}`}>Email</th>
              <th scope="col" className={`hidden md:table-cell ${TH}`}>Last visit</th>
              <th scope="col" className={`hidden sm:table-cell ${TH}`}>Total spent</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <CustomerRow key={customer.id} customer={customer} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
