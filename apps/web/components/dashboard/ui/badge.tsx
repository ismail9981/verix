import type { ReactNode } from "react";

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "neutral";

const TONES: Record<BadgeTone, string> = {
  success: "bg-emerald-500/10 text-emerald-400",
  warning: "bg-amber-500/10 text-amber-400",
  danger: "bg-red-500/10 text-red-400",
  info: "bg-sky-500/10 text-sky-400",
  accent: "bg-accent/10 text-accent",
  neutral: "bg-white/5 text-muted",
};

/* Shared status pill. Each module maps its own status enum to a tone, so the
   pill sizing and color scale live in one place instead of being re-declared
   in every module's status component. */
export function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
