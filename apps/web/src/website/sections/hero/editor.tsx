"use client";

import { FieldInput } from "../../../../components/dashboard/business-profile/field-input";
import { FieldSelect } from "../../../../components/dashboard/business-profile/field-select";
import type { SectionEditorProps } from "../../render/types";
import type { HeroProps } from "./index";

const ALIGN_OPTIONS = [
  { value: "center", label: "Center" },
  { value: "left", label: "Left" },
];

export function HeroEditor({ value, onChange, errors }: SectionEditorProps<HeroProps>) {
  const set = <K extends keyof HeroProps>(key: K, next: HeroProps[K]) =>
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
      <FieldInput
        label="Subheading"
        name="subheading"
        value={value.subheading}
        onChange={(e) => set("subheading", e.target.value)}
        error={errors?.subheading?.[0]}
      />
      <div className="grid grid-cols-2 gap-4">
        <FieldInput
          label="Button label"
          name="ctaLabel"
          value={value.ctaLabel}
          onChange={(e) => set("ctaLabel", e.target.value)}
        />
        <FieldInput
          label="Button link"
          name="ctaHref"
          value={value.ctaHref}
          onChange={(e) => set("ctaHref", e.target.value)}
        />
      </div>
      <FieldSelect
        label="Alignment"
        name="align"
        options={ALIGN_OPTIONS}
        value={value.align}
        onChange={(e) => set("align", e.target.value as HeroProps["align"])}
      />
    </div>
  );
}
