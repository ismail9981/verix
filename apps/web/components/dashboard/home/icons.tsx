import type { ReactNode } from "react";
import type { IconProps } from "../types";

/* A couple of dashboard-home glyphs not in the shared sets. Same 24px grid
   and stroke weight as the landing / dashboard icons. */
function Line({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Line>
  );
}

export function TrendUpIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M4 15.5 10 9.5l3.5 3.5L20 6.5" />
      <path d="M15 6.5h5v5" />
    </Line>
  );
}

export function TrendDownIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M4 8.5 10 14.5l3.5-3.5L20 17.5" />
      <path d="M15 17.5h5v-5" />
    </Line>
  );
}

export function UserPlusIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="9" cy="8" r="4" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M18 8v6M15 11h6" />
    </Line>
  );
}
