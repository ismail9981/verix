"use client";

import { FieldInput } from "../../../../components/dashboard/business-profile/field-input";
import { FieldTextarea } from "../../../../components/dashboard/business-profile/field-textarea";
import { Toggle } from "../../../../components/dashboard/business-profile/toggle";
import type { SectionEditorProps } from "../../render/types";
import { CONTACT_FORM_FIELD_KEYS, type ContactFormFieldKey, type ContactProps } from "./schema";

const FIELD_LABELS: Record<ContactFormFieldKey, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  subject: "Subject",
  message: "Message",
};

export function ContactEditor({ value, onChange, errors }: SectionEditorProps<ContactProps>) {
  const set = <K extends keyof ContactProps>(key: K, next: ContactProps[K]) =>
    onChange({ ...value, [key]: next });

  const setForm = <K extends keyof ContactProps["form"]>(
    key: K,
    next: ContactProps["form"][K],
  ) => onChange({ ...value, form: { ...value.form, [key]: next } });

  const setFormField = (key: ContactFormFieldKey, patch: Partial<{ enabled: boolean; required: boolean }>) =>
    setForm("fields", { ...value.form.fields, [key]: { ...value.form.fields[key], ...patch } });

  return (
    <div className="flex flex-col gap-6">
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

      <div className="flex flex-col gap-4 border-t border-hairline pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">Contact form</span>
          <Toggle
            checked={value.form.enabled}
            onChange={(checked) => setForm("enabled", checked)}
            label="Enable contact form"
          />
        </div>

        {value.form.enabled ? (
          <>
            <FieldInput
              label="Form heading"
              name="formHeading"
              value={value.form.heading}
              onChange={(e) => setForm("heading", e.target.value)}
            />
            <FieldTextarea
              label="Form description"
              name="formDescription"
              rows={2}
              value={value.form.description}
              onChange={(e) => setForm("description", e.target.value)}
            />

            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-white/60">Fields</span>
              {CONTACT_FORM_FIELD_KEYS.map((key) => {
                const cfg = value.form.fields[key];
                return (
                  <div key={key} className="flex items-center justify-between gap-4 py-1">
                    <span className="text-sm text-white">{FIELD_LABELS[key]}</span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-white/70">
                        Required
                        <Toggle
                          checked={cfg.required}
                          onChange={(checked) => setFormField(key, { required: checked })}
                          label={`${FIELD_LABELS[key]} required`}
                        />
                      </label>
                      <Toggle
                        checked={cfg.enabled}
                        onChange={(checked) =>
                          setFormField(key, {
                            enabled: checked,
                            required: checked ? cfg.required : false,
                          })
                        }
                        label={`Show ${FIELD_LABELS[key]}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <FieldInput
              label="Submit button label"
              name="submitLabel"
              value={value.form.submitLabel}
              onChange={(e) => setForm("submitLabel", e.target.value)}
            />
            <FieldTextarea
              label="Success message"
              name="successMessage"
              rows={2}
              value={value.form.successMessage}
              onChange={(e) => setForm("successMessage", e.target.value)}
            />
            <FieldInput
              label="Form key (advanced, optional)"
              name="formKey"
              value={value.form.formKey}
              onChange={(e) => setForm("formKey", e.target.value)}
              helperText="Leave blank to use the section's own id. Only set this if you need a stable, human-readable key."
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
