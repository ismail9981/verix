import { getSection } from "../sections/registry";
import { buildServicesData } from "../sections/services/data";
import type { SnapshotPage } from "../render/snapshot";
import type { TemplateDefinition } from "./types";

/*
 * Build renderable snapshot pages from a template — for the gallery preview.
 * Each section's props are the section's registered defaults with the template's
 * overrides merged on top and validated by the section's own schema, which is
 * exactly what the installer persists. The output is fed to the existing
 * SnapshotPageView, so the preview shows precisely what will be installed and no
 * rendering logic is duplicated. Client-safe (no db/server imports).
 */
export function templatePreviewPages(
  template: TemplateDefinition,
): SnapshotPage[] {
  return template.pages.map((page, pageIndex) => ({
    id: `tpl-${template.key}-${pageIndex}`,
    path: page.path,
    title: page.title,
    locale: "en-us",
    position: pageIndex,
    seo: { title: page.seoTitle, description: page.seoDescription },
    sections: page.sections.map((section, sectionIndex) => {
      const def = getSection(section.typeKey);
      const merged = {
        ...((def?.defaultProps as Record<string, unknown>) ?? {}),
        ...section.props,
      };
      const parsed = def?.schema.safeParse(merged);
      const props = parsed?.success
        ? (parsed.data as Record<string, unknown>)
        : merged;
      // A brand-new site has no services yet, so the preview shows the section's
      // own empty state — an accurate reflection of the installed result.
      const data =
        section.typeKey === "services"
          ? buildServicesData(
              [],
              Number((props as { limit?: number }).limit ?? 6),
            )
          : null;
      return {
        id: `tpl-${template.key}-${pageIndex}-${sectionIndex}`,
        typeKey: section.typeKey,
        typeVersion: def?.version ?? 1,
        props,
        data,
      };
    }),
  }));
}
