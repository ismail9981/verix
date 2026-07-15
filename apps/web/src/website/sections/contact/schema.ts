import { z } from "zod";

/*
 * The Contact section's props schema, split out from `index.tsx` so it has
 * zero React/registry imports. That makes it safe for
 * `server/validators/lead-public.ts` (the public-submission pure decision
 * module, shared by the client form widget and the server route handler) to
 * import `contactSchema` directly without creating a cycle back through
 * `index.tsx` → `form-widget.tsx` → validators.
 *
 * Sprint 9: the section gains an optional, submittable public form (`form.*`)
 * alongside its original business-info card. Every new key is `.default()`-ed
 * so a pre-Sprint-9 (v1) snapshot — whose props only ever had
 * heading/email/phone/address — still parses successfully against this single
 * current schema (see `resolve-snapshot-section.ts`: there is no per-version
 * schema map, so backward compat comes entirely from these defaults, not from
 * the `version` bump itself).
 */

export const CONTACT_FORM_FIELD_KEYS = [
  "name",
  "email",
  "phone",
  "subject",
  "message",
] as const;
export type ContactFormFieldKey = (typeof CONTACT_FORM_FIELD_KEYS)[number];

const formFieldConfigSchema = z.object({
  enabled: z.boolean().default(true),
  required: z.boolean().default(false),
});
export type ContactFormFieldConfig = z.infer<typeof formFieldConfigSchema>;

/*
 * Zod v4 types `.default()`'s argument as the schema's full *output* shape,
 * not a partial — so a nested default must be a complete, already-defaulted
 * object literal rather than `{}`. These constants are that literal, defined
 * once and reused both as the default and (via `contactFormConfigSchema
 * .parse({})`) to derive `CONTACT_FORM_DEFAULTS` below.
 */
const DEFAULT_FORM_FIELDS = {
  name: { enabled: true, required: true },
  email: { enabled: true, required: true },
  phone: { enabled: true, required: false },
  subject: { enabled: false, required: false },
  message: { enabled: true, required: true },
} as const;

const contactFormFieldsSchema = z.object({
  name: formFieldConfigSchema.default(DEFAULT_FORM_FIELDS.name),
  email: formFieldConfigSchema.default(DEFAULT_FORM_FIELDS.email),
  phone: formFieldConfigSchema.default(DEFAULT_FORM_FIELDS.phone),
  subject: formFieldConfigSchema.default(DEFAULT_FORM_FIELDS.subject),
  message: formFieldConfigSchema.default(DEFAULT_FORM_FIELDS.message),
});
export type ContactFormFields = z.infer<typeof contactFormFieldsSchema>;

/** A merchant-chosen stable key so multiple contact forms can coexist; falls
 *  back to the section's own (frozen) id when unset — see `lead-public.ts`. */
const formKeySchema = z
  .string()
  .trim()
  .max(60)
  .regex(/^[a-z0-9-]*$/i, "Use only letters, numbers, and dashes")
  .default("");

export const contactFormConfigSchema = z.object({
  enabled: z.boolean().default(true),
  heading: z.string().trim().max(120).default("Send us a message"),
  description: z.string().trim().max(400).default(""),
  fields: contactFormFieldsSchema.default(DEFAULT_FORM_FIELDS),
  submitLabel: z.string().trim().min(1).max(60).default("Send message"),
  successMessage: z
    .string()
    .trim()
    .max(300)
    .default("Thanks — we'll be in touch soon."),
  formKey: formKeySchema,
});
export type ContactFormConfig = z.infer<typeof contactFormConfigSchema>;

const DEFAULT_FORM_CONFIG = {
  enabled: true,
  heading: "Send us a message",
  description: "",
  fields: DEFAULT_FORM_FIELDS,
  submitLabel: "Send message",
  successMessage: "Thanks — we'll be in touch soon.",
  formKey: "",
} as const;

export const contactSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required").max(120),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).default(""),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(300).default(""),
  form: contactFormConfigSchema.default(DEFAULT_FORM_CONFIG),
});
export type ContactProps = z.infer<typeof contactSchema>;

export const CONTACT_FORM_DEFAULTS: ContactFormConfig =
  contactFormConfigSchema.parse({});

export const CONTACT_DEFAULTS: ContactProps = {
  heading: "Get in touch",
  email: "",
  phone: "",
  address: "",
  form: CONTACT_FORM_DEFAULTS,
};
