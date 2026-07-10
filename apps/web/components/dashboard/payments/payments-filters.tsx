"use client";

import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import { FilterBar } from "../ui/filter-bar";
import type {
  PaymentFilterMethod,
  PaymentFilterStatus,
} from "../../../src/server/validators/payment";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const METHOD_OPTIONS = [
  { value: "all", label: "All methods" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "bank_transfer", label: "Bank transfer" },
];

interface PaymentsFiltersBarProps {
  search: string;
  status: PaymentFilterStatus;
  method: PaymentFilterMethod;
  onSearch: (value: string) => void;
  onStatus: (value: PaymentFilterStatus) => void;
  onMethod: (value: PaymentFilterMethod) => void;
}

export function PaymentsFiltersBar({
  search,
  status,
  method,
  onSearch,
  onStatus,
  onMethod,
}: PaymentsFiltersBarProps) {
  return (
    <FilterBar label="Filter payments">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldInput
          label="Search"
          type="search"
          placeholder="Customer name…"
          leftIcon={<SearchIcon className="h-4 w-4" />}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <FieldSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) =>
            onStatus(event.target.value as PaymentFilterStatus)
          }
        />
        <FieldSelect
          label="Payment method"
          options={METHOD_OPTIONS}
          value={method}
          onChange={(event) =>
            onMethod(event.target.value as PaymentFilterMethod)
          }
        />
      </div>
    </FilterBar>
  );
}
