import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { teamMembers, workspaces } from "../db/schema";
import { logger } from "../observability/logger";
import {
  auditIdentityRefusal,
  auditIdentityResolution,
  type AuthIdentity,
  IdentityResolutionError,
  type IdentityTransaction,
  resolveInternalIdentityInTransaction,
} from "./identity";
import { requireUser } from "./session";

/*
 * Workspace authorization.
 *
 * The single source of truth for "which workspace is this request allowed to
 * act on." It resolves the authenticated Supabase UUID through the immutable
 * identity resolver, then resolves the workspace they own or are an active
 * member of. A legitimate brand-new identity is provisioned one workspace.
 *
 * Server Actions call `getAuthorizedWorkspace()` instead of trusting a
 * client-supplied workspaceId, closing the tenant-isolation gap.
 */

export interface AuthorizedWorkspace {
  workspaceId: string;
  userId: string;
  role: string;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "workspace"
  );
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Ensure the owner has a materialized `team_members` row (verifiable membership). */
async function ensureOwnerMembership(
  tx: IdentityTransaction,
  workspaceId: string,
  userId: string,
): Promise<void> {
  await tx
    .insert(teamMembers)
    .values({ workspaceId, userId, role: "owner", status: "active" })
    .onConflictDoNothing();
}

/**
 * Given the authenticated Supabase identity, return the workspace currently
 * selected by the legacy resolver. B4 changes identity linkage only; explicit
 * Active Workspace selection remains a later task.
 */
export async function resolveAuthorizedWorkspace(authUser: {
  id: string;
  email: string | null;
  name?: string | null;
  emailVerified: boolean;
}): Promise<AuthorizedWorkspace> {
  let result: WorkspaceResolution;

  try {
    result = await db.transaction((tx) =>
      resolveAuthorizedWorkspaceInTransaction(tx, authUser),
    );
  } catch (error) {
    if (error instanceof IdentityResolutionError) {
      auditIdentityRefusal(authUser.id, error);
    }
    throw error;
  }

  auditIdentityResolution(authUser.id, result.identity);

  // Provision the CRM default pipeline for brand-new workspaces. Deliberately
  // outside the atomic tx above and swallowed on failure — CRM pipeline setup
  // is non-critical initialization that must never block sign-in. Workspaces
  // that predate Sprint 10 (or whose first attempt failed here) are healed
  // lazily by the same idempotent `ensureDefaultPipeline` from the CRM pages.
  if (result.isNewWorkspace) {
    try {
      const { ensureDefaultPipeline } = await import(
        "../services/crm-pipeline.service"
      );
      await ensureDefaultPipeline(result.workspaceId);
    } catch (error) {
      logger.error("crm.ensureDefaultPipeline failed during workspace provisioning", {
        err: error,
        workspaceId: result.workspaceId,
      });
    }
  }

  return { workspaceId: result.workspaceId, userId: result.userId, role: result.role };
}

export interface WorkspaceResolution extends AuthorizedWorkspace {
  readonly isNewWorkspace: boolean;
  readonly identity: Awaited<
    ReturnType<typeof resolveInternalIdentityInTransaction>
  >;
}

/** Transactional core used by production and local identity integration tests. */
export async function resolveAuthorizedWorkspaceInTransaction(
  tx: IdentityTransaction,
  authUser: AuthIdentity,
): Promise<WorkspaceResolution> {
  const identity = await resolveInternalIdentityInTransaction(tx, authUser);
  const userId = identity.userId;

  // Existing workspace selection semantics are deliberately unchanged in B4.
  const owned = await tx
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, userId), isNull(workspaces.deletedAt)))
    .orderBy(asc(workspaces.createdAt))
    .limit(1);

  if (owned[0]) {
    await ensureOwnerMembership(tx, owned[0].id, userId);
    return {
      workspaceId: owned[0].id,
      userId,
      role: "owner",
      isNewWorkspace: false,
      identity,
    };
  }

  const member = await tx
    .select({ id: teamMembers.workspaceId, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(workspaces, eq(workspaces.id, teamMembers.workspaceId))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, "active"),
        isNull(teamMembers.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    )
    .orderBy(asc(workspaces.createdAt))
    .limit(1);

  if (member[0]) {
    return {
      workspaceId: member[0].id,
      userId,
      role: member[0].role,
      isNewWorkspace: false,
      identity,
    };
  }

  const emailPrefix = authUser.email?.split("@")[0] ?? "workspace";
  const created = await tx
    .insert(workspaces)
    .values({
      ownerId: userId,
      name: authUser.name?.trim() || "My workspace",
      slug: `${slugify(emailPrefix)}-${randomSuffix()}`,
    })
    .returning({ id: workspaces.id });
  const workspaceId = created[0]!.id;

  await tx
    .insert(teamMembers)
    .values({ workspaceId, userId, role: "owner", status: "active" });

  return {
    workspaceId,
    userId,
    role: "owner",
    isNewWorkspace: true,
    identity,
  };
}

/** Request-scoped helper for Server Actions and page loaders. */
export async function getAuthorizedWorkspace(): Promise<AuthorizedWorkspace> {
  const user = await requireUser();
  const metadata = user.user_metadata as { full_name?: string } | undefined;
  return resolveAuthorizedWorkspace({
    id: user.id,
    email: user.email ?? null,
    name: metadata?.full_name ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
  });
}
