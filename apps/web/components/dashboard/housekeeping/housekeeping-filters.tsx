"use client";

import { FilterBar } from "../ui/filter-bar";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import {
  HOUSEKEEPING_QUICK_FILTERS,
  type HousekeepingQuickFilter,
  type HousekeepingUnitOption,
} from "../../../src/server/validators/housekeeping";
import type { PropertyOption } from "../../../src/server/validators/property";

interface BuildingOption {
  id: string;
  name: string;
}

const QUICK_FILTER_LABELS: Record<HousekeepingQuickFilter, string> = {
  all: "All",
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
  urgent: "Urgent",
  unassigned: "Unassigned",
  assigned_to_me: "Assigned to me",
};

interface HousekeepingFiltersBarProps {
  search: string;
  quickFilter: HousekeepingQuickFilter;
  propertyId: string;
  buildingId: string;
  unitId: string;
  dueDate: string;
  propertyOptions: PropertyOption[];
  buildingOptions: BuildingOption[];
  unitOptions: HousekeepingUnitOption[];
  onSearch: (value: string) => void;
  onQuickFilter: (value: HousekeepingQuickFilter) => void;
  onProperty: (value: string) => void;
  onBuilding: (value: string) => void;
  onUnit: (value: string) => void;
  onDueDate: (value: string) => void;
}

export function HousekeepingFiltersBar({
  search,
  quickFilter,
  propertyId,
  buildingId,
  unitId,
  dueDate,
  propertyOptions,
  buildingOptions,
  unitOptions,
  onSearch,
  onQuickFilter,
  onProperty,
  onBuilding,
  onUnit,
  onDueDate,
}: HousekeepingFiltersBarProps) {
  const propertySelect = [
    { value: "all", label: "All properties" },
    ...propertyOptions.map((p) => ({ value: p.id, label: p.name })),
  ];
  const buildingSelect = [
    { value: "all", label: "All buildings" },
    ...buildingOptions.map((b) => ({ value: b.id, label: b.name })),
  ];
  const unitSelect = [
    { value: "all", label: "All units" },
    ...unitOptions.map((u) => ({ value: u.id, label: `${u.propertyName} / ${u.buildingName} — ${u.name}` })),
  ];

  return (
    <FilterBar label="Filter housekeeping tasks">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Quick filters">
          {HOUSEKEEPING_QUICK_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={quickFilter === value}
              onClick={() => onQuickFilter(value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                quickFilter === value
                  ? "bg-accent text-white"
                  : "bg-white/5 text-muted hover:bg-white/10 hover:text-white"
              }`}
            >
              {QUICK_FILTER_LABELS[value]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FieldInput
            label="Search"
            type="search"
            placeholder="Title or unit…"
            leftIcon={<SearchIcon className="h-4 w-4" />}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
          <FieldSelect
            label="Property"
            options={propertySelect}
            value={propertyId}
            onChange={(event) => onProperty(event.target.value)}
          />
          <FieldSelect
            label="Building"
            options={buildingSelect}
            value={buildingId}
            onChange={(event) => onBuilding(event.target.value)}
          />
          <FieldSelect
            label="Unit"
            options={unitSelect}
            value={unitId}
            onChange={(event) => onUnit(event.target.value)}
          />
          <FieldInput
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(event) => onDueDate(event.target.value)}
          />
        </div>
      </div>
    </FilterBar>
  );
}
