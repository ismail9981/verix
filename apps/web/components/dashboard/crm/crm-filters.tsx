"use client";

import { FilterBar } from "../ui/filter-bar";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import type { CustomerFilterStatus } from "../../../src/server/validators/customer";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "new", label: "New" },
  { value: "vip", label: "VIP" },
  { value: "inactive", label: "Inactive" },
];

interface CrmFiltersBarProps {
  search: string;
  status: CustomerFilterStatus;
  onSearch: (value: string) => void;
  onStatus: (value: CustomerFilterStatus) => void;
}

export function CrmFiltersBar({
  search,
  status,
  onSearch,
  onStatus,
}: CrmFiltersBarProps) {
  return (
    <FilterBar label="Filter customers">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldInput
          label="Search"
          type="search"
          placeholder="Name, email, or phone…"
          leftIcon={<SearchIcon className="h-4 w-4" />}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <FieldSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) =>
            onStatus(event.target.value as CustomerFilterStatus)
          }
        />
      </div>
    </FilterBar>
  );
}
