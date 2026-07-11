"use client";

import { FieldInput } from "../../../../components/dashboard/business-profile/field-input";
import { FieldSelect } from "../../../../components/dashboard/business-profile/field-select";
import type { SectionEditorProps } from "../../render/types";
import type { ServicesProps } from "./index";

const COLUMN_OPTIONS = [
  { value: "2", label: "2 columns" },
  { value: "3", label: "3 columns" },
  { value: "4", label: "4 columns" },
];
const PRICE_OPTIONS = [
  { value: "true", label: "Show prices" },
  { value: "false", label: "Hide prices" },
];

export function ServicesEditor({ value, onChange, errors }: SectionEditorProps<ServicesProps>) {
  const set = <K extends keyof ServicesProps>(key: K, next: ServicesProps[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="flex flex-col gap-4">
      <FieldInput
        label="Heading"
        name="heading"
        value={value.heading}
        onChange={(e) => set("heading", e.target.value)}
        error={errors?.heading?.[0]}
      />
      <div className="grid grid-cols-3 gap-4">
        <FieldSelect
          label="Columns"
          name="columns"
          options={COLUMN_OPTIONS}
          value={String(value.columns)}
          onChange={(e) => set("columns", Number(e.target.value) as ServicesProps["columns"])}
        />
        <FieldInput
          label="Max items"
          name="limit"
          type="number"
          min={1}
          max={24}
          value={String(value.limit)}
          onChange={(e) => set("limit", Number(e.target.value))}
        />
        <FieldSelect
          label="Prices"
          name="showPrices"
          options={PRICE_OPTIONS}
          value={String(value.showPrices)}
          onChange={(e) => set("showPrices", e.target.value === "true")}
        />
      </div>
      <p className="text-xs text-muted">
        Content is pulled live from this workspace&apos;s active services.
      </p>
    </div>
  );
}
