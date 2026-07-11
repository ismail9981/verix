import { lazy } from "react";
import { z } from "zod";
import type { SectionPreviewProps } from "../../render/types";
import { defineSection } from "../define";
import { ContactIcon } from "../icons";

const ContactEditor = lazy(() =>
  import("./editor").then((m) => ({ default: m.ContactEditor })),
);

export const contactSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required").max(120),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).default(""),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(300).default(""),
});
export type ContactProps = z.infer<typeof contactSchema>;

export const CONTACT_DEFAULTS: ContactProps = {
  heading: "Get in touch",
  email: "",
  phone: "",
  address: "",
};

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

function ContactPreview({ props }: SectionPreviewProps<ContactProps, undefined>) {
  return (
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
  );
}

export const contactSection = defineSection<ContactProps>({
  key: "contact",
  version: 1,
  displayName: "Contact",
  description: "Your contact details.",
  icon: ContactIcon,
  category: "Contact",
  schema: contactSchema,
  defaultProps: CONTACT_DEFAULTS,
  Editor: ContactEditor,
  Preview: ContactPreview,
  inlineText: [{ key: "heading", label: "Heading" }],
});
