import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/db";
import { pageSections, pages, sites } from "../db/schema";
import {
  buildExportedTemplate,
  type ExportSection,
} from "../../website/templates/export-model";
import type { TemplateDefinition } from "../../website/templates/types";
import type {
  CreatePageInput,
  CreateSectionInput,
  PageInput,
  PageListItem,
  PageSectionListItem,
  SectionInput,
  SiteInput,
  SiteListItem,
  SyncSectionInput,
  SyncSectionsResult,
} from "../validators/website";

/*
 * Website Builder service (Sprint 1). Every query is scoped to `workspaceId`
 * and ignores soft-deleted rows. Mutations verify that the parent (site/page)
 * belongs to the workspace, so a client can never attach a page/section to
 * another tenant's site. Soft-deleting a site/page cascades to its descendants.
 */

// --- Sites ----------------------------------------------------------------

// Sites with a live-page count (LEFT JOIN + GROUP BY — reliable).
function sitesQuery() {
  return db
    .select({
      id: sites.id,
      name: sites.name,
      defaultLocale: sites.defaultLocale,
      status: sites.status,
      themeKey: sites.themeKey,
      publishedVersionId: sites.publishedVersionId,
      createdAt: sites.createdAt,
      seoDefaultTitle: sites.seoDefaultTitle,
      seoTitleTemplate: sites.seoTitleTemplate,
      seoDefaultDescription: sites.seoDefaultDescription,
      seoDefaultImageUrl: sites.seoDefaultImageUrl,
      seoIndexable: sites.seoIndexable,
      pageCount: sql<number>`count(${pages.id})::int`,
    })
    .from(sites)
    .leftJoin(
      pages,
      and(eq(pages.siteId, sites.id), isNull(pages.deletedAt)),
    )
    .$dynamic();
}

export async function listSites(
  workspaceId: string,
): Promise<SiteListItem[]> {
  return sitesQuery()
    .where(and(eq(sites.workspaceId, workspaceId), isNull(sites.deletedAt)))
    .groupBy(sites.id)
    .orderBy(desc(sites.createdAt));
}

async function getSiteById(
  workspaceId: string,
  id: string,
): Promise<SiteListItem> {
  const rows = await sitesQuery()
    .where(
      and(
        eq(sites.id, id),
        eq(sites.workspaceId, workspaceId),
        isNull(sites.deletedAt),
      ),
    )
    .groupBy(sites.id);
  const row = rows[0];
  if (!row) throw new Error("Site not found.");
  return row;
}

/** Throws unless the site exists in the workspace. */
export async function assertSiteInWorkspace(
  workspaceId: string,
  siteId: string,
): Promise<void> {
  const rows = await db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(
        eq(sites.id, siteId),
        eq(sites.workspaceId, workspaceId),
        isNull(sites.deletedAt),
      ),
    );
  if (!rows[0]) throw new Error("Site not found in workspace.");
}

export async function createSite(
  workspaceId: string,
  input: SiteInput,
): Promise<SiteListItem> {
  const rows = await db
    .insert(sites)
    .values({
      workspaceId,
      name: input.name,
      defaultLocale: input.defaultLocale,
      status: input.status,
      themeKey: input.themeKey ?? null,
      seoDefaultTitle: input.seoDefaultTitle ?? null,
      seoTitleTemplate: input.seoTitleTemplate ?? null,
      seoDefaultDescription: input.seoDefaultDescription ?? null,
      seoDefaultImageUrl: input.seoDefaultImageUrl ?? null,
      seoIndexable: input.seoIndexable,
    })
    .returning({ id: sites.id });
  return getSiteById(workspaceId, rows[0]!.id);
}

export async function updateSite(
  workspaceId: string,
  id: string,
  input: SiteInput,
): Promise<SiteListItem> {
  const rows = await db
    .update(sites)
    .set({
      name: input.name,
      defaultLocale: input.defaultLocale,
      status: input.status,
      themeKey: input.themeKey ?? null,
      seoDefaultTitle: input.seoDefaultTitle ?? null,
      seoTitleTemplate: input.seoTitleTemplate ?? null,
      seoDefaultDescription: input.seoDefaultDescription ?? null,
      seoDefaultImageUrl: input.seoDefaultImageUrl ?? null,
      seoIndexable: input.seoIndexable,
    })
    .where(
      and(
        eq(sites.id, id),
        eq(sites.workspaceId, workspaceId),
        isNull(sites.deletedAt),
      ),
    )
    .returning({ id: sites.id });
  if (!rows[0]) throw new Error("Site not found.");
  return getSiteById(workspaceId, id);
}

export async function softDeleteSite(
  workspaceId: string,
  id: string,
): Promise<void> {
  const now = new Date();
  const rows = await db
    .update(sites)
    .set({ deletedAt: now })
    .where(
      and(
        eq(sites.id, id),
        eq(sites.workspaceId, workspaceId),
        isNull(sites.deletedAt),
      ),
    )
    .returning({ id: sites.id });
  if (!rows[0]) throw new Error("Site not found.");

  // Cascade the soft delete to descendants so the tree stays consistent.
  await db
    .update(pages)
    .set({ deletedAt: now })
    .where(
      and(
        eq(pages.siteId, id),
        eq(pages.workspaceId, workspaceId),
        isNull(pages.deletedAt),
      ),
    );
  await db
    .update(pageSections)
    .set({ deletedAt: now })
    .where(
      and(
        eq(pageSections.siteId, id),
        eq(pageSections.workspaceId, workspaceId),
        isNull(pageSections.deletedAt),
      ),
    );
}

// --- Pages ----------------------------------------------------------------

// Pages with a live-section count (LEFT JOIN + GROUP BY).
function pagesQuery() {
  return db
    .select({
      id: pages.id,
      siteId: pages.siteId,
      path: pages.path,
      title: pages.title,
      locale: pages.locale,
      status: pages.status,
      position: pages.position,
      seoTitle: pages.seoTitle,
      seoDescription: pages.seoDescription,
      createdAt: pages.createdAt,
      seoNoIndex: pages.seoNoIndex,
      seoNoFollow: pages.seoNoFollow,
      ogTitle: pages.ogTitle,
      ogDescription: pages.ogDescription,
      ogImageUrl: pages.ogImageUrl,
      sectionCount: sql<number>`count(${pageSections.id})::int`,
    })
    .from(pages)
    .leftJoin(
      pageSections,
      and(eq(pageSections.pageId, pages.id), isNull(pageSections.deletedAt)),
    )
    .$dynamic();
}

export async function listPages(
  workspaceId: string,
  siteId: string,
): Promise<PageListItem[]> {
  return pagesQuery()
    .where(
      and(
        eq(pages.workspaceId, workspaceId),
        eq(pages.siteId, siteId),
        isNull(pages.deletedAt),
      ),
    )
    .groupBy(pages.id)
    .orderBy(asc(pages.position), asc(pages.createdAt));
}

async function getPageById(
  workspaceId: string,
  id: string,
): Promise<PageListItem> {
  const rows = await pagesQuery()
    .where(
      and(
        eq(pages.id, id),
        eq(pages.workspaceId, workspaceId),
        isNull(pages.deletedAt),
      ),
    )
    .groupBy(pages.id);
  const row = rows[0];
  if (!row) throw new Error("Page not found.");
  return row;
}

async function assertPageInWorkspace(
  workspaceId: string,
  pageId: string,
): Promise<{ siteId: string }> {
  const rows = await db
    .select({ siteId: pages.siteId })
    .from(pages)
    .where(
      and(
        eq(pages.id, pageId),
        eq(pages.workspaceId, workspaceId),
        isNull(pages.deletedAt),
      ),
    );
  const row = rows[0];
  if (!row) throw new Error("Page not found in workspace.");
  return row;
}

export async function createPage(
  workspaceId: string,
  input: CreatePageInput,
): Promise<PageListItem> {
  await assertSiteInWorkspace(workspaceId, input.siteId);
  const rows = await db
    .insert(pages)
    .values({
      workspaceId,
      siteId: input.siteId,
      path: input.path,
      title: input.title,
      locale: input.locale,
      status: input.status,
      position: input.position,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      seoNoIndex: input.seoNoIndex,
      seoNoFollow: input.seoNoFollow,
      ogTitle: input.ogTitle ?? null,
      ogDescription: input.ogDescription ?? null,
      ogImageUrl: input.ogImageUrl ?? null,
    })
    .returning({ id: pages.id });
  return getPageById(workspaceId, rows[0]!.id);
}

export async function updatePage(
  workspaceId: string,
  id: string,
  input: PageInput,
): Promise<PageListItem> {
  const rows = await db
    .update(pages)
    .set({
      path: input.path,
      title: input.title,
      locale: input.locale,
      status: input.status,
      position: input.position,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      seoNoIndex: input.seoNoIndex,
      seoNoFollow: input.seoNoFollow,
      ogTitle: input.ogTitle ?? null,
      ogDescription: input.ogDescription ?? null,
      ogImageUrl: input.ogImageUrl ?? null,
    })
    .where(
      and(
        eq(pages.id, id),
        eq(pages.workspaceId, workspaceId),
        isNull(pages.deletedAt),
      ),
    )
    .returning({ id: pages.id });
  if (!rows[0]) throw new Error("Page not found.");
  return getPageById(workspaceId, id);
}

export async function softDeletePage(
  workspaceId: string,
  id: string,
): Promise<void> {
  const now = new Date();
  const rows = await db
    .update(pages)
    .set({ deletedAt: now })
    .where(
      and(
        eq(pages.id, id),
        eq(pages.workspaceId, workspaceId),
        isNull(pages.deletedAt),
      ),
    )
    .returning({ id: pages.id });
  if (!rows[0]) throw new Error("Page not found.");

  await db
    .update(pageSections)
    .set({ deletedAt: now })
    .where(
      and(
        eq(pageSections.pageId, id),
        eq(pageSections.workspaceId, workspaceId),
        isNull(pageSections.deletedAt),
      ),
    );
}

// --- Page sections --------------------------------------------------------

const SECTION_SELECT = {
  id: pageSections.id,
  pageId: pageSections.pageId,
  siteId: pageSections.siteId,
  typeKey: pageSections.typeKey,
  typeVersion: pageSections.typeVersion,
  position: pageSections.position,
  props: pageSections.props,
  isVisible: pageSections.isVisible,
  locale: pageSections.locale,
  createdAt: pageSections.createdAt,
};

export async function listSections(
  workspaceId: string,
  pageId: string,
): Promise<PageSectionListItem[]> {
  return db
    .select(SECTION_SELECT)
    .from(pageSections)
    .where(
      and(
        eq(pageSections.workspaceId, workspaceId),
        eq(pageSections.pageId, pageId),
        isNull(pageSections.deletedAt),
      ),
    )
    .orderBy(asc(pageSections.position), asc(pageSections.createdAt));
}

async function getSectionById(
  workspaceId: string,
  id: string,
): Promise<PageSectionListItem> {
  const rows = await db
    .select(SECTION_SELECT)
    .from(pageSections)
    .where(
      and(
        eq(pageSections.id, id),
        eq(pageSections.workspaceId, workspaceId),
        isNull(pageSections.deletedAt),
      ),
    );
  const row = rows[0];
  if (!row) throw new Error("Section not found.");
  return row;
}

export async function createSection(
  workspaceId: string,
  input: CreateSectionInput,
): Promise<PageSectionListItem> {
  const { siteId } = await assertPageInWorkspace(workspaceId, input.pageId);
  const rows = await db
    .insert(pageSections)
    .values({
      workspaceId,
      pageId: input.pageId,
      siteId,
      typeKey: input.typeKey,
      typeVersion: input.typeVersion,
      position: input.position,
      props: input.props,
      isVisible: input.isVisible,
      locale: input.locale,
    })
    .returning({ id: pageSections.id });
  return getSectionById(workspaceId, rows[0]!.id);
}

export async function updateSection(
  workspaceId: string,
  id: string,
  input: SectionInput,
): Promise<PageSectionListItem> {
  const rows = await db
    .update(pageSections)
    .set({
      typeKey: input.typeKey,
      typeVersion: input.typeVersion,
      position: input.position,
      props: input.props,
      isVisible: input.isVisible,
      locale: input.locale,
    })
    .where(
      and(
        eq(pageSections.id, id),
        eq(pageSections.workspaceId, workspaceId),
        isNull(pageSections.deletedAt),
      ),
    )
    .returning({ id: pageSections.id });
  if (!rows[0]) throw new Error("Section not found.");
  return getSectionById(workspaceId, id);
}

export async function softDeleteSection(
  workspaceId: string,
  id: string,
): Promise<void> {
  const rows = await db
    .update(pageSections)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(pageSections.id, id),
        eq(pageSections.workspaceId, workspaceId),
        isNull(pageSections.deletedAt),
      ),
    )
    .returning({ id: pageSections.id });
  if (!rows[0]) throw new Error("Section not found.");
}

/*
 * Reconcile a page's sections to a desired draft state in one transaction — the
 * single persistence path for the visual builder (autosave, reorder, add,
 * duplicate, hide, delete, undo/redo). By desired id:
 *   - existing & live      → update (props/visibility/order/type)
 *   - existing & removed    → restore + update (undo of a delete, stable id)
 *   - not in the DB (temp)  → insert, mapped back via `idMap`
 * Live rows absent from the desired set are soft-deleted. Returns the
 * authoritative ordered list so the client can adopt real ids and positions.
 */
export async function syncPageSections(
  workspaceId: string,
  pageId: string,
  desired: SyncSectionInput[],
): Promise<SyncSectionsResult> {
  const { siteId } = await assertPageInWorkspace(workspaceId, pageId);

  const existing = await db
    .select({ id: pageSections.id, deletedAt: pageSections.deletedAt })
    .from(pageSections)
    .where(
      and(
        eq(pageSections.pageId, pageId),
        eq(pageSections.workspaceId, workspaceId),
      ),
    );
  const existingById = new Map(existing.map((r) => [r.id, r]));
  const desiredIds = new Set(desired.map((d) => d.id));
  const idMap: Record<string, string> = {};

  await db.transaction(async (tx) => {
    for (const s of desired) {
      const row = existingById.get(s.id);
      const values = {
        typeKey: s.typeKey,
        typeVersion: s.typeVersion,
        props: s.props,
        isVisible: s.isVisible,
        locale: s.locale,
        position: s.position,
      };
      if (row) {
        // Update in place; restore if it was previously removed (undo of delete).
        await tx
          .update(pageSections)
          .set(row.deletedAt ? { ...values, deletedAt: null } : values)
          .where(
            and(
              eq(pageSections.id, s.id),
              eq(pageSections.workspaceId, workspaceId),
            ),
          );
      } else {
        const inserted = await tx
          .insert(pageSections)
          .values({ workspaceId, pageId, siteId, ...values })
          .returning({ id: pageSections.id });
        idMap[s.id] = inserted[0]!.id;
      }
    }

    // Soft-delete live rows the client dropped.
    const toDelete = existing
      .filter((r) => r.deletedAt === null && !desiredIds.has(r.id))
      .map((r) => r.id);
    if (toDelete.length > 0) {
      await tx
        .update(pageSections)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(pageSections.workspaceId, workspaceId),
            inArray(pageSections.id, toDelete),
          ),
        );
    }
  });

  const sections = await listSections(workspaceId, pageId);
  return { sections, idMap };
}

// --- Duplicate & export ----------------------------------------------------

export interface DuplicatedSite {
  siteId: string;
  name: string;
  pageCount: number;
  sectionCount: number;
}

/** Choose a workspace-unique name so duplicates never collide. */
function uniqueCopyName(baseName: string, existing: Set<string>): string {
  let candidate = `${baseName} (copy)`;
  let n = 2;
  while (existing.has(candidate)) candidate = `${baseName} (copy ${n++})`;
  return candidate;
}

/*
 * Deep-duplicate a site into a fresh DRAFT — site → pages → sections — in one
 * transaction (rolls back entirely on failure). Order, theme, SEO and locale
 * are preserved; published versions are NOT copied (the copy has no live
 * version and starts as a draft). Reads are bulk (no N+1); pre-generated ids let
 * pages and their sections insert in one statement each.
 */
export async function duplicateSite(
  workspaceId: string,
  siteId: string,
): Promise<DuplicatedSite> {
  return db.transaction(async (tx) => {
    const source = (
      await tx
        .select({
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
    if (!source) throw new Error("Site not found.");

    const existingNames = new Set(
      (
        await tx
          .select({ name: sites.name })
          .from(sites)
          .where(
            and(eq(sites.workspaceId, workspaceId), isNull(sites.deletedAt)),
          )
      ).map((r) => r.name),
    );

    const srcPages = await tx
      .select({
        id: pages.id,
        path: pages.path,
        title: pages.title,
        locale: pages.locale,
        status: pages.status,
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

    const srcSections = await tx
      .select({
        pageId: pageSections.pageId,
        typeKey: pageSections.typeKey,
        typeVersion: pageSections.typeVersion,
        position: pageSections.position,
        props: pageSections.props,
        isVisible: pageSections.isVisible,
        locale: pageSections.locale,
      })
      .from(pageSections)
      .where(
        and(
          eq(pageSections.siteId, siteId),
          eq(pageSections.workspaceId, workspaceId),
          isNull(pageSections.deletedAt),
        ),
      )
      .orderBy(asc(pageSections.position), asc(pageSections.createdAt));

    const newSiteId = crypto.randomUUID();
    const newName = uniqueCopyName(source.name, existingNames);
    await tx.insert(sites).values({
      id: newSiteId,
      workspaceId,
      name: newName,
      defaultLocale: source.defaultLocale,
      status: "draft",
      themeKey: source.themeKey,
      seoDefaultTitle: source.seoDefaultTitle,
      seoTitleTemplate: source.seoTitleTemplate,
      seoDefaultDescription: source.seoDefaultDescription,
      seoDefaultImageUrl: source.seoDefaultImageUrl,
      seoIndexable: source.seoIndexable,
    });

    const pageIdMap = new Map<string, string>();
    if (srcPages.length > 0) {
      await tx.insert(pages).values(
        srcPages.map((p) => {
          const newId = crypto.randomUUID();
          pageIdMap.set(p.id, newId);
          return {
            id: newId,
            workspaceId,
            siteId: newSiteId,
            path: p.path,
            title: p.title,
            locale: p.locale,
            status: p.status,
            position: p.position,
            seoTitle: p.seoTitle,
            seoDescription: p.seoDescription,
            seoNoIndex: p.seoNoIndex,
            seoNoFollow: p.seoNoFollow,
            ogTitle: p.ogTitle,
            ogDescription: p.ogDescription,
            ogImageUrl: p.ogImageUrl,
          };
        }),
      );
    }

    if (srcSections.length > 0) {
      await tx.insert(pageSections).values(
        srcSections.map((s) => ({
          workspaceId,
          pageId: pageIdMap.get(s.pageId)!,
          siteId: newSiteId,
          typeKey: s.typeKey,
          typeVersion: s.typeVersion,
          position: s.position,
          props: s.props,
          isVisible: s.isVisible,
          locale: s.locale,
        })),
      );
    }

    return {
      siteId: newSiteId,
      name: newName,
      pageCount: srcPages.length,
      sectionCount: srcSections.length,
    };
  });
}

/*
 * Export a (non-deleted) site's structure as a reusable TemplateDefinition JSON.
 * Reads are bulk (no N+1); the pure `buildExportedTemplate` shapes + validates
 * the blueprint and strips all ids/workspace/timestamps/versions.
 */
export async function exportSiteAsTemplate(
  workspaceId: string,
  siteId: string,
): Promise<TemplateDefinition> {
  const site = (
    await db
      .select({ name: sites.name, themeKey: sites.themeKey })
      .from(sites)
      .where(
        and(
          eq(sites.id, siteId),
          eq(sites.workspaceId, workspaceId),
          isNull(sites.deletedAt),
        ),
      )
  )[0];
  if (!site) throw new Error("Site not found.");

  const [srcPages, srcSections] = await Promise.all([
    db
      .select({
        id: pages.id,
        path: pages.path,
        title: pages.title,
        position: pages.position,
        seoTitle: pages.seoTitle,
        seoDescription: pages.seoDescription,
      })
      .from(pages)
      .where(
        and(
          eq(pages.siteId, siteId),
          eq(pages.workspaceId, workspaceId),
          isNull(pages.deletedAt),
        ),
      ),
    db
      .select({
        pageId: pageSections.pageId,
        typeKey: pageSections.typeKey,
        position: pageSections.position,
        props: pageSections.props,
        isVisible: pageSections.isVisible,
      })
      .from(pageSections)
      .where(
        and(
          eq(pageSections.siteId, siteId),
          eq(pageSections.workspaceId, workspaceId),
          isNull(pageSections.deletedAt),
        ),
      ),
  ]);

  return buildExportedTemplate(site, srcPages, srcSections as ExportSection[]);
}
