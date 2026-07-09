"use client";

import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import { FilterBar } from "../ui/filter-bar";
import { DATE_OPTIONS, METHOD_OPTIONS, STATUS_OPTIONS } from "./mock-data";
import type { PaymentFilters } from "./types";

interface PaymentsFiltersBarProps {
  filters: PaymentFilters;
  onChange: (filters: PaymentFilters) => void;
}

export function PaymentsFiltersBar({
  filters,
  onChange,
}: PaymentsFiltersBarProps) {
  const set = <K extends keyof PaymentFilters>(
    key: K,
    value: PaymentFilters[K],
  ) => onChange({ ...filters, [key]: value });

  return (
    <FilterBar label="Filter payments">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FieldInput
          label="Search"
          type="search"
          placeholder="Invoice or customer…"
          leftIcon={<SearchIcon className="h-4 w-4" />}
          value={filters.search}
          onChange={(event) => set("search", event.target.value)}
        />
        <FieldSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(event) => set("status", event.target.value)}
        />
        <FieldSelect
          label="Payment method"
          options={METHOD_OPTIONS}
          value={filters.method}
          onChange={(event) => set("method", event.target.value)}
        />
        <FieldSelect
          label="Date range"
          options={DATE_OPTIONS}
          value={filters.date}
          onChange={(event) => set("date", event.target.value)}
        />
      </div>
    </FilterBar>
  );
}
