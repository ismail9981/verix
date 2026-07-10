import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../db/db";
import { teamMembers, users, workspaces } from "../db/schema";
import { requireUser } from "./session";

/*
 * Workspace authorization.
 *
 * The single source of truth for "which workspace is this request allowed to
 * act on." It reads the authenticated Supabase user, links them to a
 * `public.users` row (by email), and resolves the workspace they own or are an
 * active member of — verifying membership before returning the id. A brand-new
 * user (first sign-in) is provisioned their own workspace + owner membership.
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
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  workspaceId: string,
  userId: string,
): Promise<void> {
  await tx
    .insert(teamMembers)
    .values({ workspaceId, userId, role: "owner", status: "active" })
    .onConflictDoNothing();
}

/**
 * Testable core: given the authenticated user's email/name, return the
 * workspace they're authorized for (owned or active membership), provisioning
 * one on first sign-in. Runs in a transaction so linking/provisioning is atomic.
 */
export async function resolveAuthorizedWorkspace(authUser: {
  email: string;
  name?: string | null;
}): Promise<AuthorizedWorkspace> {
  const email = authUser.email.trim().toLowerCase();
  if (!email) throw new Error("Authenticated user has no email.");

  return db.transaction(async (tx) => {
    // 1. Link (or create) the public.users row for this auth user.
    const existingUser = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    let userId = existingUser[0]?.id;
    if (!userId) {
      const inserted = await tx
        .insert(users)
        .values({ email, fullName: authUser.name ?? null, emailVerified: true })
        .returning({ id: users.id });
      userId = inserted[0]!.id;
    }

    // 2. A workspace the user owns.
    const owned = await tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.ownerId, userId), isNull(workspaces.deletedAt)))
      .orderBy(asc(workspaces.createdAt))
      .limit(1);

    if (owned[0]) {
      await ensureOwnerMembership(tx, owned[0].id, userId);
      return { workspaceId: owned[0].id, userId, role: "owner" };
    }

    // 3. A workspace where the user is an active member.
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
      return { workspaceId: member[0].id, userId, role: member[0].role };
    }

    // 4. First sign-in: provision a fresh workspace owned by the user.
    const base = slugify(email.split("@")[0] ?? "workspace");
    const created = await tx
      .insert(workspaces)
      .values({
        ownerId: userId,
        name: authUser.name?.trim() || "My workspace",
        slug: `${base}-${randomSuffix()}`,
      })
      .returning({ id: workspaces.id });
    const workspaceId = created[0]!.id;

    await tx
      .insert(teamMembers)
      .values({ workspaceId, userId, role: "owner", status: "active" });

    return { workspaceId, userId, role: "owner" };
  });
}

/** Request-scoped helper for Server Actions and page loaders. */
export async function getAuthorizedWorkspace(): Promise<AuthorizedWorkspace> {
  const user = await requireUser();
  const metadata = user.user_metadata as { full_name?: string } | undefined;
  return resolveAuthorizedWorkspace({
    email: user.email ?? "",
    name: metadata?.full_name ?? null,
  });
}
