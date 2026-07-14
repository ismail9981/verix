import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { pageSections, pages, sites } from "../db/schema";
import { getSection } from "../../website/sections/registry";
import { resolveSectionData } from "../../website/render/section-data";
import { resolveTheme } from "../../website/theme/resolve";
import {
  SNAPSHOT_FORMAT_VERSION,
  type SiteSeo,
  type SiteSnapshot,
  type SnapshotPage,
  type SnapshotSection,
} from "../../website/render/snapshot";
import type { SectionContext } from "../../website/render/types";
import type { PublishIssue } from "../validators/website";
import { safeUrlSchema } from "../validators/seo";

/*
 * The Snapshot Compiler. Reads the normalized draft (sites → pages →
 * page_sections), resolves every section against the code Section Registry,
 * freezes live data (e.g. the Services grid) and the resolved theme tokens, and
 * emits one denormalized, self-contained document.
 *
 * It never throws on bad content: invalid/unknown sections are still embedded
 * (the renderer degrades them to a graceful fallback) and reported as `issues`.
 * The publish pipeline decides policy — it refuses to persist when issues exist;
 * preview renders the same snapshot regardless, guaranteeing preview ≡ published.
 */

export interface CompileResult {
  snapshot: SiteSnapshot;
  issues: PublishIssue[];
}

/*
 * Defense-in-depth re-validation of image URLs at publish time. The Server
 * Action input schemas (`siteInputSchema`/`pageInputSchema`) already reject
 * unsafe URL schemes on every save, so this should only ever fire for
 * legacy/edge-case rows written outside that path — in which case it's a
 * real "content problem" the existing `PublishIssue` blocking mechanism
 * already handles for section props, not a case for silently sanitizing.
 */
function checkImageUrl(
  url: string | null,
  pageTitle: string,
  fieldLabel: string,
  issues: PublishIssue[],
): string | null {
  if (!url) return null;
  const parsed = safeUrlSchema.safeParse(url);
  if (!parsed.success) {
    issues.push({
      pageTitle,
      sectionKey: "seo",
      message: `${fieldLabel} is not a safe http(s) URL — fix or clear it before publishing.`,
    });
    return null;
  }
  return parsed.data;
}

export async function compileSiteSnapshot(
  workspaceId: string,
  siteId: string,
): Promise<CompileResult> {
  const siteRow = (
    await db
      .select({
        id: sites.id,
        name: sites.name,
        defaultLocale: sites.defaultLocale,
        themeKey: sites.themeKey,
        seoDefaultTitle: sites.seoDefaultTitle,
        seoTitleTemplate: sites.seoTitleTemplate,
        seoDefaultDescription: sites.seoDefaultDescription,
        seoDefaultImageUrl: sites.seoDefaultImageUrl,
        seoIndexable: sites.seoIndexable,
      })
      .from(sites)
      .where(
        and(
          eq(sites.id, siteId),
          eq(sites.workspaceId, workspaceId),
          isNull(sites.deletedAt),
        ),
      )
  )[0];
  if (!siteRow) throw new Error("Site not found.");

  // Freeze the resolved theme tokens — the snapshot never depends on the theme
  // registry at render time, so a later theme change/removal can't break it.
  const theme = resolveTheme(siteRow.themeKey);

  const pageRows = await db
    .select({
      id: pages.id,
      path: pages.path,
      title: pages.title,
      locale: pages.locale,
      position: pages.position,
      seoTitle: pages.seoTitle,
      seoDescription: pages.seoDescription,
      seoNoIndex: pages.seoNoIndex,
      seoNoFollow: pages.seoNoFollow,
      ogTitle: pages.ogTitle,
      ogDescription: pages.ogDescription,
      ogImageUrl: pages.ogImageUrl,
    })
    .from(pages)
    .where(
      and(
        eq(pages.siteId, siteId),
        eq(pages.workspaceId, workspaceId),
        isNull(pages.deletedAt),
      ),
    )
    .orderBy(asc(pages.position), asc(pages.createdAt));

  // All visible sections for the site in one query, grouped by page below.
  const sectionRows = await db
    .select({
      id: pageSections.id,
      pageId: pageSections.pageId,
      typeKey: pageSections.typeKey,
      typeVersion: pageSections.typeVersion,
      position: pageSections.position,
      props: pageSections.props,
    })
    .from(pageSections)
    .where(
      and(
        eq(pageSections.siteId, siteId),
        eq(pageSections.workspaceId, workspaceId),
        eq(pageSections.isVisible, true),
        isNull(pageSections.deletedAt),
      ),
    )
    .orderBy(asc(pageSections.position), asc(pageSections.createdAt));

  const byPage = new Map<string, typeof sectionRows>();
  for (const row of sectionRows) {
    const list = byPage.get(row.pageId) ?? [];
    list.push(row);
    byPage.set(row.pageId, list);
  }

  const ctx: SectionContext = { workspaceId };
  const issues: PublishIssue[] = [];
  const snapshotPages: SnapshotPage[] = [];

  for (const page of pageRows) {
    const sections: SnapshotSection[] = [];
    for (const row of byPage.get(page.id) ?? []) {
      const compiled = await compileSection(row, page.title, ctx, issues);
      sections.push(compiled);
    }
    snapshotPages.push({
      id: page.id,
      path: page.path,
      title: page.title,
      locale: page.locale,
      position: page.position,
      seo: {
        title: page.seoTitle,
        description: page.seoDescription,
        noIndex: page.seoNoIndex,
        noFollow: page.seoNoFollow,
        ogTitle: page.ogTitle,
        ogDescription: page.ogDescription,
        ogImageUrl: checkImageUrl(page.ogImageUrl, page.title, "Social image", issues),
      },
      sections,
    });
  }

  const siteSeo: SiteSeo = {
    defaultTitle: siteRow.seoDefaultTitle,
    titleTemplate: siteRow.seoTitleTemplate,
    defaultDescription: siteRow.seoDefaultDescription,
    defaultImageUrl: checkImageUrl(siteRow.seoDefaultImageUrl, "Site", "Default social image", issues),
    indexable: siteRow.seoIndexable,
  };

  const snapshot: SiteSnapshot = {
    format: SNAPSHOT_FORMAT_VERSION,
    site: {
      id: siteRow.id,
      name: siteRow.name,
      defaultLocale: siteRow.defaultLocale,
      themeKey: theme.key,
      seo: siteSeo,
    },
    theme: { key: theme.key, tokens: theme.tokens },
    pages: snapshotPages,
    publishedAt: new Date().toISOString(),
  };

  return { snapshot, issues };
}

async function compileSection(
  row: {
    id: string;
    typeKey: string;
    typeVersion: number;
    props: Record<string, unknown>;
  },
  pageTitle: string,
  ctx: SectionContext,
  issues: PublishIssue[],
): Promise<SnapshotSection> {
  const base = {
    id: row.id,
    typeKey: row.typeKey,
    typeVersion: row.typeVersion,
  };

  const def = getSection(row.typeKey);
  if (!def) {
    issues.push({
      pageTitle,
      sectionKey: row.typeKey,
      message: "Unknown section type — remove it or update the app.",
    });
    return { ...base, props: row.props, data: null };
  }

  const parsed = def.schema.safeParse(row.props);
  if (!parsed.success) {
    issues.push({
      pageTitle,
      sectionKey: row.typeKey,
      message:
        parsed.error.issues[0]?.message ?? "Section content is invalid.",
    });
    return { ...base, props: row.props, data: null };
  }

  // Validated props are re-serialized as the frozen record.
  const props = parsed.data as Record<string, unknown>;
  try {
    const data = await resolveSectionData(row.typeKey, props, ctx);
    return { ...base, props, data: data ?? null };
  } catch {
    issues.push({
      pageTitle,
      sectionKey: row.typeKey,
      message: "Could not resolve this section's live data.",
    });
    return { ...base, props, data: null };
  }
}
