import "server-only";
import { db } from "../../server/db/db";
import { pageSections, pages, sites } from "../../server/db/schema";
import { getSection } from "../sections/registry";
import { resolveTheme } from "../theme/resolve";
import { POSITION_STEP } from "../builder/position";
import { getTemplate } from "./registry";
import type { TemplateDefinition } from "./types";

/*
 * Template installer. Materializes a template blueprint into a real draft site
 * — site → pages → sections — inside ONE transaction, so a failure at any step
 * rolls the whole thing back and never leaves a half-built site. It reuses the
 * existing schema, the Section Registry (defaults + per-section validation) and
 * the Theme resolver; it does not touch the publishing pipeline or renderer.
 * Workspace-scoped throughout (the caller passes the authorized workspaceId).
 */

export interface InstallTemplateInput {
  templateKey: string;
  siteName: string;
  locale: string;
}

export interface InstalledSite {
  siteId: string;
  siteName: string;
  themeKey: string;
  pageCount: number;
  sectionCount: number;
}

/** Resolve a template by key from the registry, then install it. */
export async function createSiteFromTemplate(
  workspaceId: string,
  input: InstallTemplateInput,
): Promise<InstalledSite> {
  const template = getTemplate(input.templateKey);
  if (!template) throw new Error("Unknown template.");
  return installTemplate(
    workspaceId,
    { siteName: input.siteName, locale: input.locale },
    template,
  );
}

/**
 * Install a concrete template definition. Exposed so a caller can install a
 * blueprint directly; `createSiteFromTemplate` is the registry-backed entry.
 */
export async function installTemplate(
  workspaceId: string,
  input: { siteName: string; locale: string },
  template: TemplateDefinition,
): Promise<InstalledSite> {
  // A registered theme key resolves to itself; resolveTheme also guards against
  // an unknown key by falling back, so the site always gets a valid theme.
  const theme = resolveTheme(template.themeKey);

  return db.transaction(async (tx) => {
    const [site] = await tx
      .insert(sites)
      .values({
        workspaceId,
        name: input.siteName,
        defaultLocale: input.locale,
        status: "draft",
        themeKey: theme.key,
      })
      .returning({ id: sites.id });
    const siteId = site!.id;

    let sectionCount = 0;

    for (const [pageIndex, page] of template.pages.entries()) {
      const [pageRow] = await tx
        .insert(pages)
        .values({
          workspaceId,
          siteId,
          path: page.path,
          title: page.title,
          locale: input.locale,
          status: "draft",
          position: pageIndex,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
        })
        .returning({ id: pages.id });
      const pageId = pageRow!.id;

      for (const [sectionIndex, section] of page.sections.entries()) {
        const def = getSection(section.typeKey);
        if (!def) {
          // Rolls back the whole transaction — no partial site is left behind.
          throw new Error(
            `Template "${template.key}" references unknown section "${section.typeKey}".`,
          );
        }
        // Merge template overrides onto the section's defaults and validate
        // against the section's own schema — no prop shapes are duplicated.
        const props = def.schema.parse({
          ...(def.defaultProps as Record<string, unknown>),
          ...section.props,
        }) as Record<string, unknown>;

        await tx.insert(pageSections).values({
          workspaceId,
          pageId,
          siteId,
          typeKey: section.typeKey,
          typeVersion: def.version,
          position: (sectionIndex + 1) * POSITION_STEP,
          props,
          isVisible: section.isVisible,
          locale: input.locale,
        });
        sectionCount += 1;
      }
    }

    return {
      siteId,
      siteName: input.siteName,
      themeKey: theme.key,
      pageCount: template.pages.length,
      sectionCount,
    };
  });
}
