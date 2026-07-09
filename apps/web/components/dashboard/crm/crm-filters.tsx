"use client";

import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import { LAST_VISIT_OPTIONS, STATUS_OPTIONS, TAG_OPTIONS } from "./mock-data";
import type { CrmFilters } from "./types";

interface CrmFiltersBarProps {
  filters: CrmFilters;
  onChange: (filters: CrmFilters) => void;
}

export function CrmFiltersBar({ filters, onChange }: CrmFiltersBarProps) {
  const set = <K extends keyof CrmFilters>(key: K, value: CrmFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <section
      aria-label="Filter customers"
      className="rounded-2xl border border-hairline bg-surface/40 p-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FieldInput
          label="Search"
          type="search"
          placeholder="Name, email, or phone…"
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
          label="Tags"
          options={TAG_OPTIONS}
          value={filters.tag}
          onChange={(event) => set("tag", event.target.value)}
        />
        <FieldSelect
          label="Last visit"
          options={LAST_VISIT_OPTIONS}
          value={filters.lastVisit}
          onChange={(event) => set("lastVisit", event.target.value)}
        />
      </div>
    </section>
  );
}
