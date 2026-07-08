import type { EntityStatus } from "./types";

const STYLES: Record<EntityStatus, string> = {
  Active: "bg-emerald-500/10 text-emerald-400",
  Draft: "bg-amber-500/10 text-amber-400",
  Inactive: "bg-white/5 text-muted",
};

export function StatusBadge({ status }: { status: EntityStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
