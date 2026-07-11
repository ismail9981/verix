"use client";

import { FieldInput } from "../../../../components/dashboard/business-profile/field-input";
import { FieldTextarea } from "../../../../components/dashboard/business-profile/field-textarea";
import type { SectionEditorProps } from "../../render/types";
import type { AboutProps } from "./index";

export function AboutEditor({ value, onChange, errors }: SectionEditorProps<AboutProps>) {
  const set = <K extends keyof AboutProps>(key: K, next: AboutProps[K]) =>
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
      <FieldTextarea
        label="Body"
        name="body"
        rows={5}
        value={value.body}
        onChange={(e) => set("body", e.target.value)}
      />
      {errors?.body?.[0] ? (
        <p className="-mt-2 text-xs text-red-400">{errors.body[0]}</p>
      ) : null}
      <FieldInput
        label="Image URL"
        name="imageUrl"
        type="url"
        placeholder="https://…"
        value={value.imageUrl}
        onChange={(e) => set("imageUrl", e.target.value)}
      />
    </div>
  );
}
