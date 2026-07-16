"use client";

import { FilterBar } from "../ui/filter-bar";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import type {
  ReservationFilterStatus,
  ReservationPersonOption,
} from "../../../src/server/validators/reservation";
import type { RentalUnitOption } from "../../../src/server/validators/rental-unit";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "inquiry", label: "Inquiry" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked in" },
  { value: "checked_out", label: "Checked out" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

interface ReservationFiltersBarProps {
  search: string;
  status: ReservationFilterStatus;
  unitId: string;
  staffId: string;
  unitOptions: RentalUnitOption[];
  staffOptions: ReservationPersonOption[];
  onSearch: (value: string) => void;
  onStatus: (value: ReservationFilterStatus) => void;
  onUnit: (value: string) => void;
  onStaff: (value: string) => void;
}

export function ReservationFiltersBar({
  search,
  status,
  unitId,
  staffId,
  unitOptions,
  staffOptions,
  onSearch,
  onStatus,
  onUnit,
  onStaff,
}: ReservationFiltersBarProps) {
  const unitSelectOptions = [
    { value: "all", label: "All units" },
    ...unitOptions.map((u) => ({ value: u.id, label: u.name })),
  ];
  const staffSelectOptions = [
    { value: "all", label: "All staff" },
    ...staffOptions.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <FilterBar label="Filter reservations">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FieldInput
          label="Search"
          type="search"
          placeholder="Customer or unit…"
          leftIcon={<SearchIcon className="h-4 w-4" />}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <FieldSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) => onStatus(event.target.value as ReservationFilterStatus)}
        />
        <FieldSelect
          label="Unit"
          options={unitSelectOptions}
          value={unitId}
          onChange={(event) => onUnit(event.target.value)}
        />
        <FieldSelect
          label="Staff"
          options={staffSelectOptions}
          value={staffId}
          onChange={(event) => onStaff(event.target.value)}
        />
      </div>
    </FilterBar>
  );
}
