import { getSection } from "../sections/registry";
import { defineTemplate } from "./define";
import type { TemplateDefinition } from "./types";

/*
 * Build a reusable TemplateDefinition from a site's structure. Pure and
 * client-safe (no db) so it is unit-testable and shares the same registry the
 * installer uses. It emits ONLY blueprint data — pages, sections, theme,
 * metadata — never ids, workspace_id, timestamps or published versions, so the
 * result round-trips straight back through the installer.
 */

export class TemplateExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateExportError";
  }
}

export interface ExportSite {
  name: string;
  themeKey: string | null;
}
export interface ExportPage {
  id: string;
  path: string;
  title: string;
  position: number;
  seoTitle: string | null;
  seoDescription: string | null;
}
export interface ExportSection {
  pageId: string;
  typeKey: string;
  position: number;
  props: Record<string, unknown>;
  isVisible: boolean;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "exported-site"
  );
}

export function buildExportedTemplate(
  site: ExportSite,
  pages: ExportPage[],
  sections: ExportSection[],
): TemplateDefinition {
  const byPage = new Map<string, ExportSection[]>();
  for (const section of sections) {
    const list = byPage.get(section.pageId) ?? [];
    list.push(section);
    byPage.set(section.pageId, list);
  }

  const templatePages = [...pages]
    .sort((a, b) => a.position - b.position)
    .map((page) => ({
      path: page.path,
      title: page.title,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      sections: [...(byPage.get(page.id) ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((section) => {
          const def = getSection(section.typeKey);
          if (!def) {
            throw new TemplateExportError(
              `Section "${section.typeKey}" is not a known type and can't be exported.`,
            );
          }
          // Validate against the section's schema so the export re-installs.
          const parsed = def.schema.safeParse(section.props);
          if (!parsed.success) {
            throw new TemplateExportError(
              `The "${section.typeKey}" section has content that isn't valid to export.`,
            );
          }
          return {
            typeKey: section.typeKey,
            props: parsed.data as Record<string, unknown>,
            isVisible: section.isVisible,
          };
        }),
    }));

  try {
    // defineTemplate validates the whole blueprint (and strips to the schema).
    return defineTemplate({
      key: slugify(site.name),
      version: 1,
      name: site.name,
      description: `Exported from "${site.name}".`.slice(0, 300),
      category: "custom",
      thumbnail: "",
      themeKey: site.themeKey || "modern",
      pages: templatePages,
      metadata: { tags: ["exported"] },
    });
  } catch (error) {
    if (error instanceof TemplateExportError) throw error;
    throw new TemplateExportError(
      "This site could not be exported as a valid template.",
    );
  }
}
