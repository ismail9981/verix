"use client";

import { FieldInput } from "../../../../components/dashboard/business-profile/field-input";
import { FieldTextarea } from "../../../../components/dashboard/business-profile/field-textarea";
import type { SectionEditorProps } from "../../render/types";
import type { ContactProps } from "./index";

export function ContactEditor({ value, onChange, errors }: SectionEditorProps<ContactProps>) {
  const set = <K extends keyof ContactProps>(key: K, next: ContactProps[K]) =>
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
      <div className="grid grid-cols-2 gap-4">
        <FieldInput
          label="Email"
          name="email"
          type="email"
          value={value.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors?.email?.[0]}
        />
        <FieldInput
          label="Phone"
          name="phone"
          value={value.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </div>
      <FieldTextarea
        label="Address"
        name="address"
        rows={3}
        value={value.address}
        onChange={(e) => set("address", e.target.value)}
      />
    </div>
  );
}
