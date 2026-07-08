import type { PageStatus } from "./types";

const STYLES: Record<PageStatus, string> = {
  Published: "bg-emerald-500/10 text-emerald-400",
  Draft: "bg-amber-500/10 text-amber-400",
};

export function StatusPill({ status }: { status: PageStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
