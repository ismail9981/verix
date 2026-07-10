"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { UserPlusIcon } from "../home/icons";
import { TableEmptyState, TableSkeleton } from "../ui/table-states";
import { TeamIcon } from "../icons";
import { CustomerActions } from "./customer-actions";
import { StatusPill } from "./status-pill";
import {
  avatarColor,
  formatDate,
  formatMoney,
  initials,
  statusLabel,
} from "./customer-format";
import type { CustomerListItem } from "../../../src/server/validators/customer";

interface CustomerTableProps {
  customers: CustomerListItem[];
  loading: boolean;
  filtersActive: boolean;
  pending: boolean;
  onView: (customer: CustomerListItem) => void;
  onEdit: (customer: CustomerListItem) => void;
  onDelete: (customer: CustomerListItem) => void;
  onClearFilters: () => void;
  onAdd: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function CustomerRow({
  customer,
  onView,
  onEdit,
  onDelete,
}: {
  customer: CustomerListItem;
  onView: (customer: CustomerListItem) => void;
  onEdit: (customer: CustomerListItem) => void;
  onDelete: (customer: CustomerListItem) => void;
}) {
  return (
    <tr
      onClick={() => onView(customer)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: avatarColor(customer.id) }}
          >
            {initials(customer.name)}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onView(customer);
            }}
            className="truncate text-left text-sm font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {customer.name}
          </button>
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted xl:table-cell">
        {customer.phone ?? "—"}
      </td>
      <td className="hidden px-5 py-3 text-muted lg:table-cell">
        <span className="block max-w-[16rem] truncate">
          {customer.email ?? "—"}
        </span>
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">
        {formatDate(customer.createdAt)}
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 font-medium text-white sm:table-cell">
        {formatMoney(customer.totalSpentCents)}
      </td>
      <td className="px-5 py-3">
        <StatusPill status={statusLabel(customer.status)} />
      </td>
      <td
        className="px-3 py-3 text-right"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <CustomerActions
            onView={() => onView(customer)}
            onEdit={() => onEdit(customer)}
            onDelete={() => onDelete(customer)}
          />
        </div>
      </td>
    </tr>
  );
}

export function CustomerTable({
  customers,
  loading,
  filtersActive,
  pending,
  onView,
  onEdit,
  onDelete,
  onClearFilters,
  onAdd,
}: CustomerTableProps) {
  return (
    <SectionCard
      id="customers"
      title="All customers"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">
            {customers.length} {customers.length === 1 ? "result" : "results"}
          </span>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : customers.length === 0 ? (
        filtersActive ? (
          <TableEmptyState
            icon={TeamIcon}
            title="No customers found"
            description="No customers match your filters. Try adjusting or clearing them."
            onClear={onClearFilters}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
              <TeamIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-white">
              No customers yet
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Add your first customer to start building your CRM.
            </p>
            <Button
              type="button"
              size="sm"
              className={`${CTA_SECONDARY} mt-4`}
              leftIcon={<UserPlusIcon className="h-4 w-4" />}
              onClick={onAdd}
            >
              Add customer
            </Button>
          </div>
        )
      ) : (
        <div
          aria-busy={pending}
          className={`transition-opacity ${pending ? "opacity-60" : ""}`}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">Customers</caption>
            <thead>
              <tr className="border-y border-hairline text-left text-xs text-muted">
                <th scope="col" className={TH}>
                  Customer
                </th>
                <th scope="col" className={`hidden xl:table-cell ${TH}`}>
                  Phone
                </th>
                <th scope="col" className={`hidden lg:table-cell ${TH}`}>
                  Email
                </th>
                <th scope="col" className={`hidden md:table-cell ${TH}`}>
                  Added
                </th>
                <th scope="col" className={`hidden sm:table-cell ${TH}`}>
                  Total spent
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
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
