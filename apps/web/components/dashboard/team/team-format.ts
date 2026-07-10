import type {
  MemberRoleValue,
  MemberStatusValue,
} from "../../../src/server/validators/team";

/* Presentation helpers for the Team module. Avatar helpers are shared. */

export { avatarColor, initials } from "../ui/avatar";

const ROLE_LABELS: Record<MemberRoleValue, string> = {
  owner: "Owner",
  manager: "Manager",
  employee: "Employee",
};

export function roleLabel(role: MemberRoleValue): string {
  return ROLE_LABELS[role];
}

const STATUS_LABELS: Record<MemberStatusValue, string> = {
  active: "Active",
  invited: "Invited",
  suspended: "Suspended",
};

export function statusLabel(status: MemberStatusValue): string {
  return STATUS_LABELS[status];
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
