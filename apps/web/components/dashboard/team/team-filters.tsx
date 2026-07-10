"use client";

import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import { FilterBar } from "../ui/filter-bar";
import type {
  MemberFilterRole,
  MemberFilterStatus,
} from "../../../src/server/validators/team";

const ROLE_OPTIONS = [
  { value: "all", label: "All roles" },
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

interface TeamFiltersBarProps {
  search: string;
  role: MemberFilterRole;
  status: MemberFilterStatus;
  onSearch: (value: string) => void;
  onRole: (value: MemberFilterRole) => void;
  onStatus: (value: MemberFilterStatus) => void;
}

export function TeamFiltersBar({
  search,
  role,
  status,
  onSearch,
  onRole,
  onStatus,
}: TeamFiltersBarProps) {
  return (
    <FilterBar label="Filter team">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldInput
          label="Search"
          type="search"
          placeholder="Name or email…"
          leftIcon={<SearchIcon className="h-4 w-4" />}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <FieldSelect
          label="Role"
          options={ROLE_OPTIONS}
          value={role}
          onChange={(event) => onRole(event.target.value as MemberFilterRole)}
        />
        <FieldSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) =>
            onStatus(event.target.value as MemberFilterStatus)
          }
        />
      </div>
    </FilterBar>
  );
}
