import { z } from "zod";

/*
 * Validation + shared types for the Team feature.
 *
 * Roles/statuses use the DB enums directly. The status filter is a 2-state
 * Active/Inactive projection over the 3-state enum (inactive = invited or
 * suspended).
 */

export const MEMBER_ROLES = ["owner", "manager", "employee"] as const;
export type MemberRoleValue = (typeof MEMBER_ROLES)[number];

export const MEMBER_STATUSES = ["active", "invited", "suspended"] as const;
export type MemberStatusValue = (typeof MEMBER_STATUSES)[number];

export const MEMBER_FILTER_ROLES = ["all", ...MEMBER_ROLES] as const;
export type MemberFilterRole = (typeof MEMBER_FILTER_ROLES)[number];

export const MEMBER_FILTER_STATUSES = ["all", "active", "inactive"] as const;
export type MemberFilterStatus = (typeof MEMBER_FILTER_STATUSES)[number];

/** Lean DTO (member joined with its user) sent to the client. */
export interface TeamMemberListItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRoleValue;
  status: MemberStatusValue;
  title: string | null;
  createdAt: Date;
}

export interface TeamStats {
  total: number;
  active: number;
  owners: number;
  managers: number;
}

export const inviteMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.email("Enter a valid email address"),
  role: z.enum(MEMBER_ROLES),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({
  role: z.enum(MEMBER_ROLES),
  status: z.enum(MEMBER_STATUSES),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const teamFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  role: z.enum(MEMBER_FILTER_ROLES).catch("all"),
  status: z.enum(MEMBER_FILTER_STATUSES).catch("all"),
});
export type TeamFilters = z.infer<typeof teamFiltersSchema>;

/** Thrown when inviting someone who is already an active member. */
export const DUPLICATE_MEMBERSHIP_ERROR = "DUPLICATE_MEMBERSHIP";
