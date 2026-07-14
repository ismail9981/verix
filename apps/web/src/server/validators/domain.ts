import { z } from "zod";

/*
 * Domain validation + pure helpers. Client-safe (no db). Hostnames are lowercase
 * DNS names; subdomains are a single reserved-word-free label under the app
 * domain; custom domains are full hostnames that may not sit under the app
 * domain. Duplicate detection is done in the service against the DB.
 */

export const DOMAIN_TYPES = ["subdomain", "custom"] as const;
export type DomainType = (typeof DOMAIN_TYPES)[number];

export const DOMAIN_STATUSES = [
  "pending",
  "verified",
  "active",
  "failed",
] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

/** The app's subdomain suffix. Subdomains are `<label>.verix.app`. */
export const APP_DOMAIN = "verix.app";

/** Labels that may not be claimed as a subdomain (or a custom domain's first label). */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "app",
  "www",
  "mail",
  "support",
  "status",
  "cdn",
]);

// A single DNS label: 1–63 chars, a–z 0–9 and hyphens, no leading/trailing hyphen.
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
// A full hostname: dot-separated labels ending in an alphabetic TLD.
const HOSTNAME_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function isValidLabel(label: string): boolean {
  return LABEL_RE.test(label);
}
export function isValidHostname(hostname: string): boolean {
  return HOSTNAME_RE.test(hostname);
}
export function isReserved(label: string): boolean {
  return RESERVED_SUBDOMAINS.has(label);
}

/** The stored hostname for a domain input. */
export function composeHostname(type: DomainType, value: string): string {
  return type === "subdomain" ? `${value}.${APP_DOMAIN}` : value;
}

/** A safe, non-reserved subdomain label derived from a site name. */
export function slugifyLabel(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
  if (!base || isReserved(base) || !isValidLabel(base)) {
    return base ? `${base}-site`.slice(0, 63) : "site";
  }
  return base;
}

// --- DTO -------------------------------------------------------------------

export interface DomainListItem {
  id: string;
  siteId: string;
  hostname: string;
  type: DomainType;
  status: DomainStatus;
  isPrimary: boolean;
  createdAt: Date;
}

// --- Schemas ---------------------------------------------------------------

/*
 * Add-domain input. `value` is lowercased and, per type, is either a subdomain
 * label (→ `<label>.verix.app`) or a full custom hostname.
 */
export const createDomainSchema = z
  .object({
    siteId: z.uuid("Select a site"),
    type: z.enum(DOMAIN_TYPES),
    value: z.string().trim().toLowerCase().min(1, "Enter a domain").max(253),
  })
  .superRefine((data, ctx) => {
    if (data.type === "subdomain") {
      if (!isValidLabel(data.value)) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Use lowercase letters, numbers and hyphens.",
        });
      } else if (isReserved(data.value)) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "That name is reserved.",
        });
      }
      return;
    }
    // custom
    if (!isValidHostname(data.value)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Enter a valid domain (e.g. example.com).",
      });
      return;
    }
    if (data.value === APP_DOMAIN || data.value.endsWith(`.${APP_DOMAIN}`)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `${APP_DOMAIN} addresses are added as subdomains, not custom domains.`,
      });
    } else if (isReserved(data.value.split(".")[0] ?? "")) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "That name is reserved.",
      });
    }
  });
export type CreateDomainInput = z.infer<typeof createDomainSchema>;

export const updateDomainSchema = z.object({
  status: z.enum(DOMAIN_STATUSES),
});
export type UpdateDomainInput = z.infer<typeof updateDomainSchema>;
