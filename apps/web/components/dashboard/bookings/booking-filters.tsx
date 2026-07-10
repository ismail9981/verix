"use client";

import { FilterBar } from "../ui/filter-bar";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import type {
  BookingFilterStatus,
  BookingOption,
} from "../../../src/server/validators/booking";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

interface BookingFiltersBarProps {
  search: string;
  status: BookingFilterStatus;
  service: string;
  serviceOptions: BookingOption[];
  onSearch: (value: string) => void;
  onStatus: (value: BookingFilterStatus) => void;
  onService: (value: string) => void;
}

export function BookingFiltersBar({
  search,
  status,
  service,
  serviceOptions,
  onSearch,
  onStatus,
  onService,
}: BookingFiltersBarProps) {
  const serviceSelectOptions = [
    { value: "all", label: "All services" },
    ...serviceOptions.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <FilterBar label="Filter bookings">
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
            onStatus(event.target.value as BookingFilterStatus)
          }
        />
        <FieldSelect
          label="Service"
          options={serviceSelectOptions}
          value={service}
          onChange={(event) => onService(event.target.value)}
        />
      </div>
    </FilterBar>
  );
}
