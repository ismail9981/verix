"use client";

import { FilterBar } from "../ui/filter-bar";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import type { LeadFilterStatus } from "../../../src/server/validators/lead";

const STATUS_OPTIONS: { value: LeadFilterStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "archived", label: "Archived" },
  { value: "spam", label: "Spam" },
];

interface LeadFiltersBarProps {
  search: string;
  status: LeadFilterStatus;
  siteId: string;
  from: string;
  to: string;
  siteOptions: { value: string; label: string }[];
  onSearch: (value: string) => void;
  onStatus: (value: LeadFilterStatus) => void;
  onSite: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}

export function LeadFiltersBar({
  search,
  status,
  siteId,
  from,
  to,
  siteOptions,
  onSearch,
  onStatus,
  onSite,
  onFrom,
  onTo,
}: LeadFiltersBarProps) {
  return (
    <FilterBar label="Filter leads">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <FieldInput
          label="Search"
          type="search"
          placeholder="Name, email, phone, subject…"
          leftIcon={<SearchIcon className="h-4 w-4" />}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <FieldSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) => onStatus(event.target.value as LeadFilterStatus)}
        />
        <FieldSelect
          label="Site"
          options={[{ value: "", label: "All sites" }, ...siteOptions]}
          value={siteId}
          onChange={(event) => onSite(event.target.value)}
        />
        <FieldInput
          label="From"
          type="date"
          value={from}
          onChange={(event) => onFrom(event.target.value)}
        />
        <FieldInput
          label="To"
          type="date"
          value={to}
          onChange={(event) => onTo(event.target.value)}
        />
      </div>
    </FilterBar>
  );
}
