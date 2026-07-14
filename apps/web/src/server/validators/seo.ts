import { z } from "zod";
import { cleanOptional } from "./shared";

/*
 * Shared SEO validation primitives (Sprint 8). Used by both the site- and
 * page-level input schemas in `website.ts`, and re-applied defensively at
 * publish time by the Snapshot Compiler (`website-snapshot.ts`) as a
 * defense-in-depth net against legacy/edge-case rows. No raw HTML or
 * arbitrary JSON-LD is ever accepted here — only plain, length-bounded text
 * and http(s) URLs.
 */

/** Schemes that must never survive into a public `<meta>`, `href`, or JSON-LD field. */
const UNSAFE_URL_SCHEMES = /^(javascript|data|file|vbscript):/i;

/** Collapses newlines/tabs/runs of whitespace to a single space and trims. */
function normalizeWhitespace(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** Strips ASCII control characters (defense against header/HTML injection via copy-paste). */
function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/** A short, single-line SEO text field (titles). Newlines/tabs are normalized to spaces before the control-character check, so only genuinely unsafe bytes (e.g. a stray NUL) are rejected. */
export function seoTitleSchema(max = 200) {
  return z
    .string()
    .transform(normalizeWhitespace)
    .pipe(
      z
        .string()
        .max(max, `Keep it under ${max} characters`)
        .refine((v) => !hasControlCharacters(v), "Contains invalid characters"),
    );
}

/** A longer SEO text field (descriptions). Same rules, larger cap. */
export function seoDescriptionSchema(max = 500) {
  return seoTitleSchema(max);
}

/**
 * An absolute `http(s)` URL only — rejects `javascript:`/`data:`/`file:`/
 * `vbscript:` and any value that isn't a well-formed absolute URL up front,
 * before the scheme check even runs (a relative path or bare string never
 * reaches `new URL()` successfully and is rejected the same way).
 */
export const safeUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL is too long")
  .refine((v) => !hasControlCharacters(v), "Contains invalid characters")
  .refine((v) => !UNSAFE_URL_SCHEMES.test(v), "This URL scheme is not allowed")
  .refine((v) => {
    try {
      const url = new URL(v);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a valid http(s) URL");

/** Optional variant: blank/whitespace-only input persists as `undefined` (NULL). */
export const optionalSafeUrlSchema = z.preprocess(cleanOptional, safeUrlSchema.optional());

/** Optional short SEO text field, blank persists as `undefined` (NULL). */
export function optionalSeoTitleSchema(max = 200) {
  return z.preprocess(cleanOptional, seoTitleSchema(max).optional());
}

/** Optional long SEO text field, blank persists as `undefined` (NULL). */
export function optionalSeoDescriptionSchema(max = 500) {
  return z.preprocess(cleanOptional, seoDescriptionSchema(max).optional());
}

/** A robots boolean toggle coerced from a form checkbox's `"true"`/`"on"`/boolean value. */
export const robotsBooleanSchema = z.preprocess(
  (v) => v === "true" || v === "on" || v === true,
  z.boolean(),
);
