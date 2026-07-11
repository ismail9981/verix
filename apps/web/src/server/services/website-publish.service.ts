import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/db";
import { siteVersions, sites } from "../db/schema";
import { compileSiteSnapshot } from "./website-snapshot";
import {
  siteSnapshotSchema,
  type SiteSnapshot,
} from "../../website/render/snapshot";
import type {
  PublishInput,
  PublishIssue,
  SiteVersionListItem,
} from "../validators/website";

/*
 * Publishing pipeline (validate → compile → persist → flip) and the public
 * snapshot read. Immutable versions make rollback a pointer flip and keep the
 * public hot path to a single cached, zero-join row read.
 */

/** Thrown when the draft fails publish-time validation; carries actionable issues. */
export class PublishValidationError extends Error {
  constructor(readonly issues: PublishIssue[]) {
    super("The site has content problems that must be fixed before publishing.");
    this.name = "PublishValidationError";
  }
}

async function assertSiteInWorkspace(
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

/**
 * Publish: compile the draft, refuse if it has issues, then insert a new
 * immutable version and flip the live pointer — all in one transaction.
 */
export async function publishSite(
  workspaceId: string,
  siteId: string,
  userId: string,
  input: PublishInput,
): Promise<SiteVersionListItem> {
  await assertSiteInWorkspace(workspaceId, siteId);

  const { snapshot, issues } = await compileSiteSnapshot(workspaceId, siteId);
  if (issues.length > 0) throw new PublishValidationError(issues);

  return db.transaction(async (tx) => {
    const maxRows = await tx
      .select({ max: sql<number>`coalesce(max(${siteVersions.versionNumber}), 0)` })
      .from(siteVersions)
      .where(eq(siteVersions.siteId, siteId));
    const nextNumber = (maxRows[0]?.max ?? 0) + 1;

    // Demote the previous live version(s) — there is only ever one, but this is
    // defensive against partial prior state.
    await tx
      .update(siteVersions)
      .set({ status: "superseded" })
      .where(
        and(
          eq(siteVersions.siteId, siteId),
          eq(siteVersions.status, "published"),
        ),
      );

    const inserted = (
      await tx
        .insert(siteVersions)
        .values({
          siteId,
          workspaceId,
          versionNumber: nextNumber,
          status: "published",
          label: input.label ?? null,
          snapshot: snapshot as unknown as Record<string, unknown>,
          createdBy: userId,
        })
        .returning({
          id: siteVersions.id,
          versionNumber: siteVersions.versionNumber,
          status: siteVersions.status,
          label: siteVersions.label,
          publishedAt: siteVersions.publishedAt,
          createdAt: siteVersions.createdAt,
        })
    )[0]!;

    await tx
      .update(sites)
      .set({ publishedVersionId: inserted.id, status: "published" })
      .where(and(eq(sites.id, siteId), eq(sites.workspaceId, workspaceId)));

    return { ...inserted, isLive: true };
  });
}

/** Roll back the live pointer to any prior version — instant, no recompile. */
export async function rollbackToVersion(
  workspaceId: string,
  siteId: string,
  versionId: string,
): Promise<void> {
  const target = (
    await db
      .select({ id: siteVersions.id })
      .from(siteVersions)
      .where(
        and(
          eq(siteVersions.id, versionId),
          eq(siteVersions.siteId, siteId),
          eq(siteVersions.workspaceId, workspaceId),
        ),
      )
  )[0];
  if (!target) throw new Error("Version not found for this site.");

  await db.transaction(async (tx) => {
    await tx
      .update(siteVersions)
      .set({ status: "superseded" })
      .where(
        and(
          eq(siteVersions.siteId, siteId),
          eq(siteVersions.status, "published"),
        ),
      );
    await tx
      .update(siteVersions)
      .set({ status: "published" })
      .where(eq(siteVersions.id, versionId));
    await tx
      .update(sites)
      .set({ publishedVersionId: versionId, status: "published" })
      .where(and(eq(sites.id, siteId), eq(sites.workspaceId, workspaceId)));
  });
}

/** Unpublish: the public route then serves 404. Versions are retained. */
export async function unpublishSite(
  workspaceId: string,
  siteId: string,
): Promise<void> {
  const rows = await db
    .update(sites)
    .set({ status: "unpublished" })
    .where(
      and(
        eq(sites.id, siteId),
        eq(sites.workspaceId, workspaceId),
        isNull(sites.deletedAt),
      ),
    )
    .returning({ id: sites.id });
  if (!rows[0]) throw new Error("Site not found.");
}

/** Version history for the editor. `isLive` marks the currently-served version. */
export async function listVersions(
  workspaceId: string,
  siteId: string,
): Promise<SiteVersionListItem[]> {
  const site = (
    await db
      .select({ publishedVersionId: sites.publishedVersionId, status: sites.status })
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

  const rows = await db
    .select({
      id: siteVersions.id,
      versionNumber: siteVersions.versionNumber,
      status: siteVersions.status,
      label: siteVersions.label,
      publishedAt: siteVersions.publishedAt,
      createdAt: siteVersions.createdAt,
    })
    .from(siteVersions)
    .where(
      and(
        eq(siteVersions.siteId, siteId),
        eq(siteVersions.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(siteVersions.versionNumber));

  const liveId = site.status === "published" ? site.publishedVersionId : null;
  return rows.map((r) => ({ ...r, isLive: r.id === liveId }));
}

/*
 * Public read: the published snapshot for a site, or null when the site is not
 * published / has no valid snapshot. NOT workspace-scoped — the public renderer
 * is unauthenticated and the snapshot is self-contained (host→site is the trust
 * boundary). A single indexed, zero-extra-join row read. It is intentionally
 * uncached here so a publish/rollback is visible immediately; layering ISR /
 * tag-based caching (Next's `use cache` + cacheTag) is a follow-up.
 */
export async function getPublishedSnapshot(
  siteId: string,
): Promise<SiteSnapshot | null> {
  const row = (
    await db
      .select({ snapshot: siteVersions.snapshot })
      .from(sites)
      .innerJoin(siteVersions, eq(siteVersions.id, sites.publishedVersionId))
      .where(
        and(
          eq(sites.id, siteId),
          eq(sites.status, "published"),
          isNull(sites.deletedAt),
          eq(siteVersions.status, "published"),
        ),
      )
  )[0];
  if (!row) return null;

  // Read-time guard: a shape mismatch (e.g. an old format) is treated as absent
  // rather than crashing the public render.
  const parsed = siteSnapshotSchema.safeParse(row.snapshot);
  return parsed.success ? parsed.data : null;
}
