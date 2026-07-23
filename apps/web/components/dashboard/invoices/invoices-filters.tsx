"use client";

import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import { FilterBar } from "../ui/filter-bar";
import type { InvoiceStatusFilter } from "./types";

const STATUS_OPTIONS: { value: InvoiceStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
  { value: "written_off", label: "Written off" },
];

interface InvoicesFiltersBarProps {
  search: string;
  status: InvoiceStatusFilter;
  onSearch: (value: string) => void;
  onStatus: (value: InvoiceStatusFilter) => void;
}

export function InvoicesFiltersBar({
  search,
  status,
  onSearch,
  onStatus,
}: InvoicesFiltersBarProps) {
  return (
    <FilterBar label="Filter invoices">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldInput
          label="Search"
          type="search"
          placeholder="Invoice number or customer…"
          leftIcon={<SearchIcon className="h-4 w-4" />}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <FieldSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) =>
            onStatus(event.target.value as InvoiceStatusFilter)
          }
        />
      </div>
    </FilterBar>
  );
}
