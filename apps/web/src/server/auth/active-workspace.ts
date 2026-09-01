import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomUUID } from "node:crypto";
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
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  verifyActiveWorkspaceCookie,
} from "./active-workspace-cookie";
import { requireUser } from "./session";
import { capabilitiesForRole, type Capability } from "./capabilities";

export type ActiveWorkspaceSelectionSource =
  "single_membership" | "signed_cookie" | "new_user_provisioning";

export interface WorkspaceContext {
  readonly workspaceId: string;
  readonly internalUserId: string;
  readonly authUserId: string;
  readonly membershipId: string;
  readonly role: string;
  readonly capabilities: readonly Capability[];
  readonly selectionSource: ActiveWorkspaceSelectionSource;
}

export interface WorkspaceOption {
  readonly workspaceId: string;
  readonly membershipId: string;
  readonly name: string;
  readonly role: string;
  readonly plan: string;
}

interface WorkspaceMembershipCandidate extends WorkspaceOption {
  readonly workspaceStatus: "active" | "suspended";
}

export type ActiveWorkspaceResolution =
  | {
      readonly state: "NONE";
      readonly internalUserId: string;
      readonly options: readonly [];
    }
  | {
      readonly state: "AUTO_SELECTED";
      readonly context: WorkspaceContext;
      readonly options: readonly WorkspaceOption[];
    }
  | {
      readonly state: "SELECTION_REQUIRED";
      readonly internalUserId: string;
      readonly options: readonly WorkspaceOption[];
    }
  | {
      readonly state: "SELECTED";
      readonly context: WorkspaceContext;
      readonly options: readonly WorkspaceOption[];
    }
  | {
      readonly state: "INVALID_SELECTION";
      readonly internalUserId: string;
      readonly options: readonly WorkspaceOption[];
    };

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "workspace"
  );
}

async function workspaceMembershipCandidates(
  tx: IdentityTransaction,
  userId: string,
): Promise<WorkspaceMembershipCandidate[]> {
  // Materialize only usable ownership relationships. Existing memberships on
  // suspended Workspaces remain intact but cannot create an active context.
  await tx.execute(sql`
    insert into public.team_members (workspace_id, user_id, role, status)
    select w.id, ${userId}::uuid, 'owner', 'active'
    from public.workspaces w
    where w.owner_id = ${userId}::uuid
      and w.status = 'active'
      and w.deleted_at is null
    on conflict (workspace_id, user_id) do nothing
  `);
  return tx
    .select({
      workspaceId: teamMembers.workspaceId,
      membershipId: teamMembers.id,
      name: workspaces.name,
      role: teamMembers.role,
      plan: workspaces.plan,
      workspaceStatus: workspaces.status,
    })
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
    .orderBy(asc(workspaces.name), asc(teamMembers.id));
}

function context(
  authUserId: string,
  internalUserId: string,
  option: WorkspaceOption,
  selectionSource: ActiveWorkspaceSelectionSource,
): WorkspaceContext {
  return {
    workspaceId: option.workspaceId,
    internalUserId,
    authUserId,
    membershipId: option.membershipId,
    role: option.role,
    capabilities: capabilitiesForRole(option.role),
    selectionSource,
  };
}

export async function resolveActiveWorkspaceInTransaction(
  tx: IdentityTransaction,
  authIdentity: AuthIdentity,
  selectedWorkspaceId: string | null,
  selectionWasInvalid = false,
): Promise<
  ActiveWorkspaceResolution & {
    readonly identityKind: string;
    readonly isNewWorkspace: boolean;
  }
> {
  const identity = await resolveInternalIdentityInTransaction(tx, authIdentity);
  const candidates = await workspaceMembershipCandidates(tx, identity.userId);
  let options: WorkspaceOption[] = candidates
    .filter(({ workspaceStatus }) => workspaceStatus === "active")
    .map(({ workspaceId, membershipId, name, role, plan }) => ({
      workspaceId,
      membershipId,
      name,
      role,
      plan,
    }));
  const selectedWorkspaceIsSuspended = Boolean(
    selectedWorkspaceId &&
    candidates.some(
      ({ workspaceId, workspaceStatus }) =>
        workspaceId === selectedWorkspaceId && workspaceStatus === "suspended",
    ),
  );
  let isNewWorkspace = false;

  if (options.length === 0 && identity.kind === "NEW_IDENTITY_PROVISIONED") {
    const emailPrefix = authIdentity.email?.split("@")[0] ?? "workspace";
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        ownerId: identity.userId,
        name: authIdentity.name?.trim() || "My workspace",
        slug: `${slugify(emailPrefix)}-${randomUUID().slice(0, 8)}`,
      })
      .returning({ id: workspaces.id });
    const [membership] = await tx
      .insert(teamMembers)
      .values({
        workspaceId: workspace!.id,
        userId: identity.userId,
        role: "owner",
        status: "active",
      })
      .returning({ id: teamMembers.id });
    options = [
      {
        workspaceId: workspace!.id,
        membershipId: membership!.id,
        name: authIdentity.name?.trim() || "My workspace",
        role: "owner",
        plan: "free",
      },
    ];
    isNewWorkspace = true;
  }

  const common = { identityKind: identity.kind, isNewWorkspace } as const;
  if (selectedWorkspaceIsSuspended) {
    return {
      state: "INVALID_SELECTION",
      internalUserId: identity.userId,
      options,
      ...common,
    };
  }
  if (options.length === 0) {
    return {
      state: "NONE",
      internalUserId: identity.userId,
      options: [],
      ...common,
    };
  }
  if (options.length === 1) {
    return {
      state: "AUTO_SELECTED",
      context: context(
        authIdentity.id,
        identity.userId,
        options[0]!,
        isNewWorkspace ? "new_user_provisioning" : "single_membership",
      ),
      options,
      ...common,
    };
  }
  if (selectionWasInvalid) {
    return {
      state: "INVALID_SELECTION",
      internalUserId: identity.userId,
      options,
      ...common,
    };
  }
  if (!selectedWorkspaceId) {
    return {
      state: "SELECTION_REQUIRED",
      internalUserId: identity.userId,
      options,
      ...common,
    };
  }
  const selected = options.find(
    (option) => option.workspaceId === selectedWorkspaceId,
  );
  if (!selected) {
    return {
      state: "INVALID_SELECTION",
      internalUserId: identity.userId,
      options,
      ...common,
    };
  }
  return {
    state: "SELECTED",
    context: context(
      authIdentity.id,
      identity.userId,
      selected,
      "signed_cookie",
    ),
    options,
    ...common,
  };
}

export async function resolveActiveWorkspace(
  authIdentity: AuthIdentity,
  cookieValue: string | undefined,
): Promise<ActiveWorkspaceResolution> {
  const decoded = verifyActiveWorkspaceCookie(
    cookieValue,
    process.env.ACTIVE_WORKSPACE_COOKIE_SECRET,
  );
  let result;
  try {
    result = await db.transaction((tx) =>
      resolveActiveWorkspaceInTransaction(
        tx,
        authIdentity,
        decoded?.workspaceId ?? null,
        Boolean(cookieValue && !decoded),
      ),
    );
  } catch (error) {
    if (error instanceof IdentityResolutionError)
      auditIdentityRefusal(authIdentity.id, error);
    throw error;
  }
  auditIdentityResolution(authIdentity.id, {
    userId:
      "context" in result
        ? result.context.internalUserId
        : result.internalUserId,
    kind: result.identityKind as
      "ALREADY_LINKED" | "LEGACY_LINKED" | "NEW_IDENTITY_PROVISIONED",
  });
  if (result.isNewWorkspace && "context" in result) {
    try {
      const { ensureDefaultPipeline } =
        await import("../services/crm-pipeline.service");
      await ensureDefaultPipeline(result.context.workspaceId);
    } catch (error) {
      logger.error(
        "crm.ensureDefaultPipeline failed during workspace provisioning",
        {
          err: error,
          workspaceId: result.context.workspaceId,
        },
      );
    }
  }
  if (result.state === "AUTO_SELECTED" || result.state === "SELECTED") {
    return {
      state: result.state,
      context: result.context,
      options: result.options,
    };
  }
  return {
    state: result.state,
    internalUserId: result.internalUserId,
    options: result.options,
  } as ActiveWorkspaceResolution;
}

export const getActiveWorkspaceResolution = cache(
  async (): Promise<ActiveWorkspaceResolution> => {
    const user = await requireUser();
    const metadata = user.user_metadata as { full_name?: string } | undefined;
    const cookieStore = await cookies();
    return resolveActiveWorkspace(
      {
        id: user.id,
        email: user.email ?? null,
        name: metadata?.full_name ?? null,
        emailVerified: Boolean(user.email_confirmed_at),
      },
      cookieStore.get(ACTIVE_WORKSPACE_COOKIE_NAME)?.value,
    );
  },
);

export async function getActiveWorkspaceContext(): Promise<WorkspaceContext> {
  const resolution = await getActiveWorkspaceResolution();
  if (resolution.state === "AUTO_SELECTED" || resolution.state === "SELECTED") {
    return resolution.context;
  }
  redirect(`/workspace-selection?state=${resolution.state.toLowerCase()}`);
}
