import type { CustomerStatus } from "./types";

const STYLES: Record<CustomerStatus, string> = {
  Active: "bg-emerald-500/10 text-emerald-400",
  New: "bg-sky-500/10 text-sky-400",
  VIP: "bg-amber-500/10 text-amber-400",
  Inactive: "bg-white/5 text-muted",
};

export function StatusPill({ status }: { status: CustomerStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex rounded-md border border-hairline bg-canvas/60 px-2 py-0.5 text-[11px] text-muted">
      {tag}
    </span>
  );
}
