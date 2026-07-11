import { z } from "zod";

/*
 * Template types. A template is pure, versionable *data* — a blueprint of pages
 * and sections that the installer materializes into a real site. It mirrors the
 * Section and Theme definitions (key + version + metadata) but carries no React,
 * so it can be fully Zod-validated at definition time.
 *
 * Section `props` here are partial overrides: the installer merges them onto the
 * section's registered defaults and validates against the section's own schema,
 * so templates never restate (or drift from) a section's full prop shape.
 */

export const templateSectionSchema = z.object({
  typeKey: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  props: z.record(z.string(), z.unknown()).default({}),
  isVisible: z.boolean().default(true),
});
export type TemplateSection = z.infer<typeof templateSectionSchema>;

export const templatePageSchema = z.object({
  path: z
    .string()
    .trim()
    .max(200)
    .regex(/^[a-z0-9\-/]*$/, "Use lowercase letters, numbers, hyphens and slashes"),
  title: z.string().trim().min(1).max(200),
  seoTitle: z.string().max(200).nullable().default(null),
  seoDescription: z.string().max(500).nullable().default(null),
  sections: z.array(templateSectionSchema).default([]),
});
export type TemplatePage = z.infer<typeof templatePageSchema>;

export const templateMetadataSchema = z.object({
  tags: z.array(z.string()).default([]),
});
export type TemplateMetadata = z.infer<typeof templateMetadataSchema>;

export const templateDefinitionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  version: z.number().int().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(300),
  category: z.string().trim().min(1).max(64),
  /** Short placeholder identifier (e.g. an emoji). Real thumbnails: Sprint 6.2+. */
  thumbnail: z.string().max(64).default(""),
  /** A registry theme key — validated against the Theme Registry at registration. */
  themeKey: z.string().trim().min(1).max(64),
  pages: z.array(templatePageSchema).min(1),
  metadata: templateMetadataSchema,
});

/** Authoring shape (defaults optional). */
export type TemplateInput = z.input<typeof templateDefinitionSchema>;
/** Validated, complete definition stored in the registry. */
export type TemplateDefinition = z.output<typeof templateDefinitionSchema>;
