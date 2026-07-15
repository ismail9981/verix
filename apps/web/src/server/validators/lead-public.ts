import { z } from "zod";
import {
  CONTACT_FORM_FIELD_KEYS,
  contactSchema,
  type ContactFormConfig,
  type ContactFormFieldKey,
  type ContactFormFields,
  type ContactProps,
} from "../../website/sections/contact/schema";
import type { SiteSnapshot, SnapshotSection } from "../../website/render/snapshot";
import { selectSnapshotPage } from "../../website/render/snapshot";

/*
 * Pure decision logic for public (unauthenticated) Contact-form submissions —
 * no db, no env, no server-only import. Shared by the client form widget
 * (`sections/contact/form-widget.tsx`, which only needs the field limits and
 * honeypot field name) and the server route handler
 * (`app/api/public/forms/contact/route.ts`, which needs all of it). Mirrors
 * this codebase's established pure-decision / thin-DB-shell split (see
 * `hosting/host.ts` vs `hosting/site-resolver.service.ts`), which is what
 * makes every rule here directly unit-testable without a database.
 */

export const CONTACT_SUBMISSION_FIELD_LIMITS: Record<ContactFormFieldKey, number> = {
  name: 120,
  email: 254,
  phone: 40,
  subject: 150,
  message: 2000,
};

/** A distinctly-named decoy field real users never see or fill. */
export const HONEYPOT_FIELD_NAME = "companyWebsite";

/** Below this, a submission is treated as automated (best-effort, spoofable — see route.ts). */
export const MIN_FILL_TIME_MS = 1500;

/** Hard cap on the raw request body, enforced before JSON parsing. */
export const MAX_BODY_BYTES = 8 * 1024;

const FIELD_LABELS: Record<ContactFormFieldKey, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  subject: "Subject",
  message: "Message",
};

export function isHoneypotTriggered(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** `elapsedMs` is server-now minus the client-reported form-mount time. */
export function isSubmissionTooFast(elapsedMs: number): boolean {
  return !Number.isFinite(elapsedMs) || elapsedMs < MIN_FILL_TIME_MS;
}

function fieldSchemaFor(key: ContactFormFieldKey, cfg: { enabled: boolean; required: boolean }) {
  if (!cfg.enabled) {
    // Disabled fields are accepted-and-discarded, never persisted or required.
    return z.unknown().optional().transform(() => undefined);
  }
  const limit = CONTACT_SUBMISSION_FIELD_LIMITS[key];
  if (key === "email") {
    const email = z.email("Enter a valid email address.").max(limit);
    return cfg.required
      ? email
      : z.union([z.literal(""), email]).optional().default("");
  }
  const text = z.string().trim().max(limit, `${FIELD_LABELS[key]} is too long.`);
  return cfg.required
    ? text.min(1, `${FIELD_LABELS[key]} is required.`)
    : text.optional().default("");
}

export type ContactSubmissionInput = Partial<Record<ContactFormFieldKey, string>>;

/** Builds a submission schema from the *published* form config — never the client's. */
export function buildContactSubmissionSchema(
  fields: ContactFormFields,
): z.ZodType<ContactSubmissionInput> {
  const shape = {} as Record<ContactFormFieldKey, z.ZodTypeAny>;
  for (const key of CONTACT_FORM_FIELD_KEYS) {
    shape[key] = fieldSchemaFor(key, fields[key]);
  }
  return z.object(shape) as unknown as z.ZodType<ContactSubmissionInput>;
}

/**
 * Strips a `/site/{siteId}` prefix from a client-reported pathname (the shape
 * seen when the internal fallback route is hit directly, e.g. dev or before a
 * domain is attached) so the remainder can be matched against
 * `selectSnapshotPage` the same way the real public renderer does.
 */
export function stripSitePreviewPrefix(pathname: string, siteId: string): string {
  const prefix = `/site/${siteId}`;
  if (pathname === prefix) return "/";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}

export type ContactFormResolution =
  | { status: "ok"; sectionId: string; formConfig: ContactFormConfig }
  | { status: "page-not-found" }
  | { status: "form-not-found" };

/**
 * Finds the live, visible Contact-form section a submission claims to target.
 * The snapshot is the single source of truth: hidden/soft-deleted sections
 * never made it into the snapshot in the first place (the compiler already
 * filters `is_visible`/`deleted_at`), so "not present here" already covers
 * both "never existed" and "hidden since publish" — no separate check needed.
 */
export function resolveContactFormSection(
  snapshot: SiteSnapshot,
  path: string,
  locale: string | undefined,
  formKey: string,
): ContactFormResolution {
  const page = selectSnapshotPage(snapshot, path, locale);
  if (!page) return { status: "page-not-found" };

  for (const section of page.sections) {
    if (section.typeKey !== "contact") continue;
    const parsed = contactSchema.safeParse(section.props);
    if (!parsed.success) continue;
    const props: ContactProps = parsed.data;
    if (!props.form.enabled) continue;
    const key = props.form.formKey || section.id;
    if (key === formKey) {
      return { status: "ok", sectionId: section.id, formConfig: props.form };
    }
  }
  return { status: "form-not-found" };
}

/** Only used by tests to build a fake section without pulling in the compiler. */
export function makeContactSnapshotSection(
  id: string,
  props: Partial<ContactProps>,
): SnapshotSection {
  return {
    id,
    typeKey: "contact",
    typeVersion: 2,
    props: { ...contactSchema.parse({ heading: "Contact" }), ...props },
    data: null,
  };
}

// --- Lead status -------------------------------------------------------

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "archived",
  "spam",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/**
 * `converted` may only be reached through `convertLeadToCustomer` (which
 * atomically links/creates the customer first) — never through a direct
 * status update, so a lead can never be marked converted without a customer
 * actually existing for it. Every other transition is a plain workspace
 * triage decision and is allowed, including reopening an archived/spam lead.
 */
export function isValidLeadStatusTransition(
  _current: LeadStatus,
  next: LeadStatus,
): boolean {
  return next !== "converted";
}

// --- Duplicate-lead / customer matching --------------------------------

export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/**
 * Digits only, with a leading US/Canada country code ("1" + 10 digits)
 * stripped, so "+1 (555) 123-4567", "1-555-123-4567", and "5551234567" all
 * match the same number.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export interface CustomerMatchCandidate {
  id: string;
  email: string | null;
  phone: string | null;
}

/**
 * Duplicate policy: match by normalized email first (the stronger, less
 * ambiguous identifier), then by normalized phone if no email match. Returns
 * the first candidate matched, or null to signal "create a new customer."
 */
export function findDuplicateCustomerMatch(
  candidates: readonly CustomerMatchCandidate[],
  lead: { email: string | null; phone: string | null },
): CustomerMatchCandidate | null {
  const email = normalizeEmail(lead.email);
  if (email) {
    const match = candidates.find((c) => normalizeEmail(c.email) === email);
    if (match) return match;
  }
  const phone = normalizePhone(lead.phone);
  if (phone) {
    const match = candidates.find((c) => normalizePhone(c.phone) === phone);
    if (match) return match;
  }
  return null;
}
