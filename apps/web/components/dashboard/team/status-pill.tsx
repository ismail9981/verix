import { Badge, type BadgeTone } from "../ui/badge";
import type { MemberRole, MemberStatus } from "./types";

const STATUS_TONES: Record<MemberStatus, BadgeTone> = {
  Active: "success",
  Away: "warning",
  Offline: "neutral",
};

const ROLE_TONES: Record<MemberRole, BadgeTone> = {
  Owner: "accent",
  Manager: "info",
  Employee: "neutral",
};

export function StatusPill({ status }: { status: MemberStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{status}</Badge>;
}

export function RoleBadge({ role }: { role: MemberRole }) {
  return <Badge tone={ROLE_TONES[role]}>{role}</Badge>;
}
