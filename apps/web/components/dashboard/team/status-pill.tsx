import { Badge, type BadgeTone } from "../ui/badge";
import { roleLabel, statusLabel } from "./team-format";
import type {
  MemberRoleValue,
  MemberStatusValue,
} from "../../../src/server/validators/team";

const ROLE_TONES: Record<MemberRoleValue, BadgeTone> = {
  owner: "accent",
  manager: "info",
  employee: "neutral",
};

const STATUS_TONES: Record<MemberStatusValue, BadgeTone> = {
  active: "success",
  invited: "warning",
  suspended: "neutral",
};

export function RoleBadge({ role }: { role: MemberRoleValue }) {
  return <Badge tone={ROLE_TONES[role]}>{roleLabel(role)}</Badge>;
}

export function StatusPill({ status }: { status: MemberStatusValue }) {
  return <Badge tone={STATUS_TONES[status]}>{statusLabel(status)}</Badge>;
}
