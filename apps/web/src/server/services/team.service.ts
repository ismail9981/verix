import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type ExtractTablesWithRelations,
} from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { db } from "../db/db";
import { teamMembers, users } from "../db/schema";
import {
  DUPLICATE_MEMBERSHIP_ERROR,
  type InviteMemberInput,
  type MemberFilterRole,
  type MemberFilterStatus,
  type TeamMemberListItem,
  type TeamStats,
  type UpdateMemberInput,
} from "../validators/team";

/*
 * Team service — reusable data access for a workspace's members.
 *
 * Every query joins `team_members` with `users`, is scoped to `workspaceId`,
 * and excludes soft-deleted memberships. Inviting links (or creates) the user
 * by email and never duplicates a membership; removing soft-deletes only the
 * membership, leaving the user account intact.
 */

type Schema = typeof import("../db/schema");
type Executor = PgDatabase<
  PostgresJsQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

const LIST_SELECT = {
  id: teamMembers.id,
  userId: teamMembers.userId,
  fullName: users.fullName,
  email: users.email,
  role: teamMembers.role,
  status: teamMembers.status,
  title: teamMembers.title,
  createdAt: teamMembers.createdAt,
};

type Row = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string;
  role: TeamMemberListItem["role"];
  status: TeamMemberListItem["status"];
  title: string | null;
  createdAt: Date;
};

function toDto(row: Row): TeamMemberListItem {
  return {
    id: row.id,
    userId: row.userId,
    name: row.fullName?.trim() || row.email,
    email: row.email,
    role: row.role,
    status: row.status,
    title: row.title,
    createdAt: row.createdAt,
  };
}

export async function listTeamMembers(
  workspaceId: string,
  filters: {
    search?: string;
    role?: MemberFilterRole;
    status?: MemberFilterStatus;
  } = {},
): Promise<TeamMemberListItem[]> {
  const where = [
    eq(teamMembers.workspaceId, workspaceId),
    isNull(teamMembers.deletedAt),
  ];

  if (filters.role && filters.role !== "all") {
    where.push(eq(teamMembers.role, filters.role));
  }
  if (filters.status === "active") {
    where.push(eq(teamMembers.status, "active"));
  } else if (filters.status === "inactive") {
    where.push(inArray(teamMembers.status, ["invited", "suspended"]));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    where.push(
      or(ilike(users.fullName, pattern), ilike(users.email, pattern))!,
    );
  }

  const rows = await db
    .select(LIST_SELECT)
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(and(...where))
    .orderBy(desc(teamMembers.createdAt));

  return rows.map(toDto);
}

async function getMemberById(
  exec: Executor,
  workspaceId: string,
  id: string,
): Promise<TeamMemberListItem> {
  const rows = await exec
    .select(LIST_SELECT)
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(
        eq(teamMembers.id, id),
        eq(teamMembers.workspaceId, workspaceId),
        isNull(teamMembers.deletedAt),
      ),
    );
  const row = rows[0];
  if (!row) throw new Error("Member not found.");
  return toDto(row);
}

export async function getTeamStats(workspaceId: string): Promise<TeamStats> {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${teamMembers.status} = 'active')::int`,
      owners: sql<number>`count(*) filter (where ${teamMembers.role} = 'owner')::int`,
      managers: sql<number>`count(*) filter (where ${teamMembers.role} = 'manager')::int`,
    })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.workspaceId, workspaceId), isNull(teamMembers.deletedAt)),
    );

  return rows[0] ?? { total: 0, active: 0, owners: 0, managers: 0 };
}

/**
 * Invite a member. Links the user by email (creating a `public.users` row if
 * none exists), then creates the membership. Never duplicates: an active
 * membership throws; a soft-deleted one is reactivated.
 */
export async function inviteMember(
  workspaceId: string,
  input: InviteMemberInput,
): Promise<TeamMemberListItem> {
  const email = input.email.trim().toLowerCase();

  return db.transaction(async (tx) => {
    const existingUser = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    let userId = existingUser[0]?.id;
    if (!userId) {
      const inserted = await tx
        .insert(users)
        .values({ email, fullName: input.name, emailVerified: false })
        .returning({ id: users.id });
      userId = inserted[0]!.id;
    }

    const existingMembership = await tx
      .select({ id: teamMembers.id, deletedAt: teamMembers.deletedAt })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.workspaceId, workspaceId),
          eq(teamMembers.userId, userId),
        ),
      )
      .limit(1);

    let memberId: string;
    if (existingMembership[0]) {
      if (existingMembership[0].deletedAt === null) {
        throw new Error(DUPLICATE_MEMBERSHIP_ERROR);
      }
      // Reactivate a previously removed membership (unique (workspace,user)).
      const updated = await tx
        .update(teamMembers)
        .set({ role: input.role, status: "active", deletedAt: null })
        .where(eq(teamMembers.id, existingMembership[0].id))
        .returning({ id: teamMembers.id });
      memberId = updated[0]!.id;
    } else {
      const inserted = await tx
        .insert(teamMembers)
        .values({ workspaceId, userId, role: input.role, status: "active" })
        .returning({ id: teamMembers.id });
      memberId = inserted[0]!.id;
    }

    return getMemberById(tx, workspaceId, memberId);
  });
}

export async function updateMember(
  workspaceId: string,
  id: string,
  input: UpdateMemberInput,
): Promise<TeamMemberListItem> {
  const rows = await db
    .update(teamMembers)
    .set({ role: input.role, status: input.status })
    .where(
      and(
        eq(teamMembers.id, id),
        eq(teamMembers.workspaceId, workspaceId),
        isNull(teamMembers.deletedAt),
      ),
    )
    .returning({ id: teamMembers.id });

  if (!rows[0]) throw new Error("Member not found.");
  return getMemberById(db, workspaceId, id);
}

/** Soft delete the membership only — the user account is left untouched. */
export async function removeMember(
  workspaceId: string,
  id: string,
): Promise<void> {
  const rows = await db
    .update(teamMembers)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(teamMembers.id, id),
        eq(teamMembers.workspaceId, workspaceId),
        isNull(teamMembers.deletedAt),
      ),
    )
    .returning({ id: teamMembers.id });

  if (!rows[0]) throw new Error("Member not found.");
}
