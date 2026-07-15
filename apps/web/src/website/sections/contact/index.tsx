import { lazy } from "react";
import type { SectionPreviewProps } from "../../render/types";
import { defineSection } from "../define";
import { ContactIcon } from "../icons";
import { ContactFormWidget } from "./form-widget";
import { CONTACT_DEFAULTS, contactSchema, type ContactProps } from "./schema";

export * from "./schema";

const ContactEditor = lazy(() =>
  import("./editor").then((m) => ({ default: m.ContactEditor })),
);

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-2"
      style={{ borderTop: "1px solid var(--wb-color-border)" }}
    >
      <span
        className="text-xs uppercase tracking-wide"
        style={{ color: "var(--wb-color-muted)" }}
      >
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--wb-color-text)" }}>
        {value}
      </span>
    </div>
  );
}

function ContactPreview({
  props,
  id,
}: SectionPreviewProps<ContactProps, undefined>) {
  return (
    <div className="flex flex-col gap-6">
      <div
        style={{
          background: "var(--wb-color-surface)",
          border: "1px solid var(--wb-color-border)",
          borderRadius: "var(--wb-radius-lg)",
          padding: "var(--wb-container-padding)",
          boxShadow: "var(--wb-shadow-md)",
        }}
      >
        <h2
          className="font-bold"
          style={{
            fontFamily: "var(--wb-font-heading)",
            fontSize: "calc(1.35rem * var(--wb-font-scale))",
            color: "var(--wb-color-text)",
          }}
        >
          {props.heading}
        </h2>
        <dl className="mt-3">
          <Row label="Email" value={props.email} />
          <Row label="Phone" value={props.phone} />
          <Row label="Address" value={props.address} />
        </dl>
        {!props.email && !props.phone && !props.address ? (
          <p className="mt-2 text-sm" style={{ color: "var(--wb-color-muted)" }}>
            Add your contact details in the editor.
          </p>
        ) : null}
      </div>
      {props.form.enabled ? (
        <ContactFormWidget formConfig={props.form} sectionId={id} />
      ) : null}
    </div>
  );
}

export const contactSection = defineSection<ContactProps>({
  key: "contact",
  version: 2,
  displayName: "Contact",
  description: "Your contact details and an optional submittable form.",
  icon: ContactIcon,
  category: "Contact",
  schema: contactSchema,
  defaultProps: CONTACT_DEFAULTS,
  Editor: ContactEditor,
  Preview: ContactPreview,
  inlineText: [{ key: "heading", label: "Heading" }],
});
