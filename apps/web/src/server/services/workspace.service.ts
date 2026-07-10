import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { workspaces, type Workspace } from "../db/schema";
import type { UpdateWorkspaceProfileInput } from "../validators/workspace";

/*
 * Workspace service — the reusable data-access layer for workspaces.
 *
 * Pure async functions over Drizzle, with no knowledge of HTTP, forms, or
 * React. Server actions and (future) route handlers call these; validation
 * happens at the boundary, so these functions receive already-typed input.
 */

/**
 * The current workspace. Auth is a later phase, so "the existing workspace"
 * is the oldest non-deleted one. Returns null when the database is empty.
 */
export async function getPrimaryWorkspace(): Promise<Workspace | null> {
  const rows = await db
    .select()
    .from(workspaces)
    .where(isNull(workspaces.deletedAt))
    .orderBy(asc(workspaces.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

/** A single workspace by id (excluding soft-deleted rows). */
export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  const rows = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), isNull(workspaces.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Update a workspace's profile fields and return the fresh row. `updated_at`
 * auto-bumps via the schema's `$onUpdate`. Optional fields normalize to NULL.
 * Throws if the id does not exist; unique-slug conflicts surface as the
 * driver's `23505` error for the caller to translate.
 */
export async function updateWorkspaceProfile(
  id: string,
  input: UpdateWorkspaceProfileInput,
): Promise<Workspace> {
  const rows = await db
    .update(workspaces)
    .set({
      name: input.name,
      slug: input.slug,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      timezone: input.timezone,
      currency: input.currency,
      language: input.language,
      logoUrl: input.logoUrl ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
    })
    .where(eq(workspaces.id, id))
    .returning();

  const updated = rows[0];
  if (!updated) throw new Error("Workspace not found.");
  return updated;
}
